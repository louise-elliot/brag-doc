from unittest.mock import MagicMock

import httpx
import pytest

import rate_limit


def _rpc_response(allowed: bool, count: int) -> MagicMock:
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = [{"allowed": allowed, "request_count": count}]
    return resp


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")


class TestLimitFor:
    def test_returns_default_when_env_absent(self, monkeypatch):
        monkeypatch.delenv("RATE_LIMIT_COACH_TURN", raising=False)
        assert rate_limit._limit_for("coach_turn") == 30
        assert rate_limit._limit_for("coach_reframe") == 3
        assert rate_limit._limit_for("brag_doc") == 2

    def test_env_overrides_default(self, monkeypatch):
        monkeypatch.setenv("RATE_LIMIT_BRAG_DOC", "9")
        assert rate_limit._limit_for("brag_doc") == 9


class TestSecondsUntilUtcMidnight:
    def test_returns_seconds_to_next_midnight(self):
        from datetime import datetime, timezone
        now = datetime(2026, 6, 15, 23, 59, 0, tzinfo=timezone.utc)
        assert rate_limit._seconds_until_utc_midnight(now) == 60

    def test_never_returns_zero_or_negative(self):
        from datetime import datetime, timezone
        midnight = datetime(2026, 6, 15, 0, 0, 0, tzinfo=timezone.utc)
        assert rate_limit._seconds_until_utc_midnight(midnight) >= 1


class TestCheckAndIncrement:
    def test_allows_when_rpc_allows(self, monkeypatch, configured):
        post = MagicMock(return_value=_rpc_response(True, 1))
        monkeypatch.setattr(rate_limit.httpx, "post", post)
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is True
        assert post.call_count == 1

    def test_blocks_when_rpc_disallows(self, monkeypatch, configured):
        monkeypatch.setattr(
            rate_limit.httpx, "post", MagicMock(return_value=_rpc_response(False, 2))
        )
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is False

    def test_fails_open_when_not_configured(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        post = MagicMock()
        monkeypatch.setattr(rate_limit.httpx, "post", post)
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is True
        post.assert_not_called()

    def test_fails_open_on_http_error(self, monkeypatch, configured):
        def boom(*args, **kwargs):
            raise httpx.ConnectError("down")
        monkeypatch.setattr(rate_limit.httpx, "post", boom)
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is True

    def test_sends_expected_rpc_payload(self, monkeypatch, configured):
        post = MagicMock(return_value=_rpc_response(True, 1))
        monkeypatch.setattr(rate_limit.httpx, "post", post)
        rate_limit._check_and_increment("user-1", "coach_turn", 30)
        url = post.call_args.args[0]
        body = post.call_args.kwargs["json"]
        headers = post.call_args.kwargs["headers"]
        assert url.endswith("/rest/v1/rpc/increment_usage")
        assert body["p_user_id"] == "user-1"
        assert body["p_endpoint"] == "coach_turn"
        assert body["p_limit"] == 30
        assert headers["apikey"] == "service-key"
        assert headers["Authorization"] == "Bearer service-key"
