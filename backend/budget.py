"""Global daily spend cap. Disables the LLM endpoints once the day's estimated
cost exceeds DAILY_BUDGET_USD. Fails open if the spend store is unavailable."""
from __future__ import annotations

import logging
import os
from datetime import datetime, time, timedelta, timezone

import httpx
from fastapi import HTTPException

logger = logging.getLogger("backend")


def _daily_budget_usd() -> float:
    return float(os.environ.get("DAILY_BUDGET_USD", "5.00"))


def _seconds_until_utc_midnight(now: datetime) -> int:
    tomorrow = now.date() + timedelta(days=1)
    midnight = datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)
    return max(1, int((midnight - now).total_seconds()))


def _daily_spend_usd() -> float | None:
    """Today's estimated spend, or None if the store is unavailable (fail open)."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("budget store not configured; failing open")
        return None
    day = datetime.now(timezone.utc).date().isoformat()
    try:
        resp = httpx.post(
            f"{url}/rest/v1/rpc/daily_spend_usd",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={"p_day": day},
            timeout=5.0,
        )
        resp.raise_for_status()
        return float(resp.json())
    except Exception:
        logger.warning("budget check failed; failing open", exc_info=True)
        return None


def enforce_budget() -> None:
    """FastAPI dependency: 503 if today's spend has reached the daily cap."""
    spend = _daily_spend_usd()
    if spend is None:
        return  # fail open
    budget = _daily_budget_usd()
    if spend >= budget:
        raise HTTPException(
            status_code=503,
            detail={"error": "budget_exceeded", "budget_usd": budget},
            headers={
                "Retry-After": str(
                    _seconds_until_utc_midnight(datetime.now(timezone.utc))
                )
            },
        )
