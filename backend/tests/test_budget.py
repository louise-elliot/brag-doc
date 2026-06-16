from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import HTTPException

import budget


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")


class TestDailyBudget:
    def test_default_is_5(self, monkeypatch):
        monkeypatch.delenv("DAILY_BUDGET_USD", raising=False)
        assert budget._daily_budget_usd() == 5.0

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("DAILY_BUDGET_USD", "2.50")
        assert budget._daily_budget_usd() == 2.5


class TestSecondsUntilMidnight:
    def test_never_zero(self):
        from datetime import datetime, timezone
        midnight = datetime(2026, 6, 16, 0, 0, 0, tzinfo=timezone.utc)
        assert budget._seconds_until_utc_midnight(midnight) >= 1


class TestEnforceBudget:
    def test_allows_under_cap(self, monkeypatch):
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: 1.0)
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")
        budget.enforce_budget()  # no raise

    def test_blocks_at_or_over_cap(self, monkeypatch):
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: 5.0)
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")
        with pytest.raises(HTTPException) as exc:
            budget.enforce_budget()
        assert exc.value.status_code == 503
        assert exc.value.detail["error"] == "budget_exceeded"
        assert "Retry-After" in exc.value.headers

    def test_fails_open_when_spend_unknown(self, monkeypatch):
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: None)
        budget.enforce_budget()  # no raise

    def test_daily_spend_returns_none_when_unconfigured(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        assert budget._daily_spend_usd() is None

    def test_daily_spend_parses_rpc_scalar(self, monkeypatch, configured):
        resp = MagicMock(raise_for_status=lambda: None, json=lambda: 3.5)
        monkeypatch.setattr(budget.httpx, "post", MagicMock(return_value=resp))
        assert budget._daily_spend_usd() == 3.5

    def test_daily_spend_fails_open_on_error(self, monkeypatch, configured):
        def boom(*a, **k):
            raise httpx.ConnectError("down")
        monkeypatch.setattr(budget.httpx, "post", boom)
        assert budget._daily_spend_usd() is None
