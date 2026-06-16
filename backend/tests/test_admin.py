import pytest

import admin


@pytest.fixture
def fake_rpc(monkeypatch):
    calls = {}

    def _fake(name, payload):
        calls[name] = payload
        return {
            "daily_spend_usd": 1.5,
            "daily_cost_series": [{"day": "2026-06-16", "cost_usd": 1.5, "request_count": 3}],
            "cost_breakdown": [
                {"endpoint": "coach_turn", "model": "claude-haiku-4-5-20251001",
                 "cost_usd": 1.5, "request_count": 3, "input_tokens": 3600, "output_tokens": 450}
            ],
        }[name]

    monkeypatch.setattr(admin, "_rpc", _fake)
    return calls


class TestRequireAdmin:
    def test_allowlisted_email_gets_summary(self, http_client, authed_user, monkeypatch, fake_rpc):
        monkeypatch.setenv("ADMIN_EMAILS", "test@example.com, other@x.com")
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")

        resp = http_client.get("/admin/cost/summary?days=30")

        assert resp.status_code == 200
        data = resp.json()
        assert data["budget_usd"] == 5.0
        assert data["today_spend_usd"] == 1.5
        assert data["daily"][0]["request_count"] == 3
        assert data["breakdown"][0]["endpoint"] == "coach_turn"

    def test_non_allowlisted_email_forbidden(self, http_client, authed_user, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "someone-else@x.com")
        resp = http_client.get("/admin/cost/summary")
        assert resp.status_code == 403

    def test_empty_allowlist_forbidden(self, http_client, authed_user, monkeypatch):
        monkeypatch.delenv("ADMIN_EMAILS", raising=False)
        resp = http_client.get("/admin/cost/summary")
        assert resp.status_code == 403

    def test_days_out_of_bounds_rejected(self, http_client, authed_user, monkeypatch, fake_rpc):
        monkeypatch.setenv("ADMIN_EMAILS", "test@example.com")
        assert http_client.get("/admin/cost/summary?days=0").status_code == 422
        assert http_client.get("/admin/cost/summary?days=500").status_code == 422
