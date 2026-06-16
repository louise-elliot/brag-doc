import telemetry


class TestCostUsd:
    def test_haiku_known_rates(self):
        # 1,000,000 input @ $1 + 1,000,000 output @ $5 = $6.00
        assert telemetry.cost_usd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000) == 6.0

    def test_small_request(self):
        # 1200 in @ $1/M + 150 out @ $5/M = 0.0012 + 0.00075 = 0.00195
        assert telemetry.cost_usd("claude-haiku-4-5", 1200, 150) == 0.00195

    def test_unknown_model_uses_fallback_rate(self):
        # falls back to Haiku rate rather than zero-costing
        assert telemetry.cost_usd("some-future-model", 1_000_000, 0) == 1.0


class TestLlmUsage:
    def test_holds_token_counts(self):
        u = telemetry.LlmUsage(input_tokens=10, output_tokens=20)
        assert (u.input_tokens, u.output_tokens) == (10, 20)


import json
import logging


class TestJSONFormatter:
    def test_emits_core_fields_as_json(self):
        rec = logging.LogRecord("backend", logging.INFO, __file__, 1, "hello", None, None)
        out = json.loads(telemetry.JSONFormatter().format(rec))
        assert out["message"] == "hello"
        assert out["level"] == "INFO"
        assert out["logger"] == "backend"
        assert "timestamp" in out
        assert out["request_id"] is None
        assert out["user_id"] is None

    def test_includes_extra_fields(self):
        rec = logging.LogRecord("backend", logging.INFO, __file__, 1, "llm_usage", None, None)
        rec.endpoint = "coach_turn"
        rec.cost_usd = 0.002
        out = json.loads(telemetry.JSONFormatter().format(rec))
        assert out["endpoint"] == "coach_turn"
        assert out["cost_usd"] == 0.002

    def test_reflects_contextvars(self):
        token_r = telemetry.request_id_var.set("req-123")
        token_u = telemetry.user_id_var.set("user-9")
        try:
            rec = logging.LogRecord("backend", logging.INFO, __file__, 1, "x", None, None)
            out = json.loads(telemetry.JSONFormatter().format(rec))
            assert out["request_id"] == "req-123"
            assert out["user_id"] == "user-9"
        finally:
            telemetry.request_id_var.reset(token_r)
            telemetry.user_id_var.reset(token_u)


class TestConfigureLogging:
    def test_installs_single_json_handler_on_backend_logger(self):
        telemetry.configure_logging()
        backend_logger = logging.getLogger("backend")
        assert len(backend_logger.handlers) == 1
        assert isinstance(backend_logger.handlers[0].formatter, telemetry.JSONFormatter)
        assert backend_logger.propagate is False


from fastapi import FastAPI
from fastapi.testclient import TestClient


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record):
        self.records.append(record)


class TestRequestContextMiddleware:
    def test_sets_request_id_header_and_emits_access_log(self):
        app = FastAPI()
        app.add_middleware(telemetry.RequestContextMiddleware)

        @app.get("/ping")
        def ping():
            return {"ok": True}

        handler = _ListHandler()
        backend_logger = logging.getLogger("backend")
        backend_logger.addHandler(handler)
        try:
            resp = TestClient(app).get("/ping")
        finally:
            backend_logger.removeHandler(handler)

        assert resp.status_code == 200
        assert resp.headers["X-Request-ID"]
        access = [r for r in handler.records if getattr(r, "event", None) == "access"]
        assert len(access) == 1
        assert access[0].method == "GET"
        assert access[0].path == "/ping"
        assert access[0].status_code == 200
        assert isinstance(access[0].latency_ms, int)


from unittest.mock import MagicMock

import httpx
import pytest


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")


class TestRecordLlmUsage:
    def test_noops_persistence_when_unconfigured_but_logs_event(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        post = MagicMock()
        monkeypatch.setattr(telemetry.httpx, "post", post)

        handler = _ListHandler()
        logging.getLogger("backend").addHandler(handler)
        try:
            telemetry.record_llm_usage("u1", "coach_turn", "claude-haiku-4-5", 1200, 150, 800)
        finally:
            logging.getLogger("backend").removeHandler(handler)

        post.assert_not_called()
        events = [r for r in handler.records if getattr(r, "event", None) == "llm_usage"]
        assert len(events) == 1
        assert events[0].cost_usd == 0.00195
        assert events[0].endpoint == "coach_turn"

    def test_posts_row_when_configured(self, monkeypatch, configured):
        post = MagicMock(return_value=MagicMock(raise_for_status=lambda: None))
        monkeypatch.setattr(telemetry.httpx, "post", post)
        token = telemetry.request_id_var.set("req-xyz")
        try:
            telemetry.record_llm_usage("u1", "brag_doc", "claude-haiku-4-5", 2000, 1000, 1200)
        finally:
            telemetry.request_id_var.reset(token)

        url = post.call_args.args[0]
        body = post.call_args.kwargs["json"]
        headers = post.call_args.kwargs["headers"]
        assert url.endswith("/rest/v1/llm_usage")
        assert body["endpoint"] == "brag_doc"
        assert body["input_tokens"] == 2000
        assert body["cost_usd"] == telemetry.cost_usd("claude-haiku-4-5", 2000, 1000)
        assert body["request_id"] == "req-xyz"
        assert headers["apikey"] == "service-key"

    def test_fails_open_on_http_error(self, monkeypatch, configured):
        def boom(*a, **k):
            raise httpx.ConnectError("down")
        monkeypatch.setattr(telemetry.httpx, "post", boom)
        # Must not raise.
        telemetry.record_llm_usage("u1", "coach_turn", "claude-haiku-4-5", 10, 20, 5)
