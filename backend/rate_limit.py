"""Per-user, per-endpoint daily rate limiting backed by a Postgres counter.

Enforcement happens in the backend (the trust boundary that holds the Anthropic
key). Counters live in Supabase Postgres and are checked/incremented atomically
via the `increment_usage` RPC. If the store is unreachable, we fail open.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, time, timedelta, timezone

import httpx
from fastapi import Depends, HTTPException

from auth import UserClaims, get_current_user

logger = logging.getLogger("backend")

DEFAULT_LIMITS = {
    "coach_turn": 30,
    "coach_reframe": 3,
    "brag_doc": 2,
}

_ENV_KEYS = {
    "coach_turn": "RATE_LIMIT_COACH_TURN",
    "coach_reframe": "RATE_LIMIT_COACH_REFRAME",
    "brag_doc": "RATE_LIMIT_BRAG_DOC",
}


def _limit_for(endpoint: str) -> int:
    return int(os.environ.get(_ENV_KEYS[endpoint], DEFAULT_LIMITS[endpoint]))


def _seconds_until_utc_midnight(now: datetime) -> int:
    tomorrow = now.date() + timedelta(days=1)
    midnight = datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)
    return max(1, int((midnight - now).total_seconds()))


def _check_and_increment(user_id: str, endpoint: str, limit: int) -> bool:
    """Return True if the request is allowed. Fails open (True) on any error."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("rate limit store not configured; failing open")
        return True
    day = datetime.now(timezone.utc).date().isoformat()
    try:
        resp = httpx.post(
            f"{url}/rest/v1/rpc/increment_usage",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "p_user_id": user_id,
                "p_endpoint": endpoint,
                "p_day": day,
                "p_limit": limit,
            },
            timeout=5.0,
        )
        resp.raise_for_status()
        rows = resp.json()
        row = rows[0] if isinstance(rows, list) else rows
        return bool(row["allowed"])
    except Exception:
        logger.warning("rate limit check failed; failing open", exc_info=True)
        return True


def enforce_rate_limit(endpoint: str):
    """Return a FastAPI dependency that enforces the daily cap for `endpoint`."""

    def dependency(user: UserClaims = Depends(get_current_user)) -> None:
        limit = _limit_for(endpoint)
        if not _check_and_increment(user.user_id, endpoint, limit):
            raise HTTPException(
                status_code=429,
                detail={"error": "rate_limited", "endpoint": endpoint, "limit": limit},
                headers={
                    "Retry-After": str(
                        _seconds_until_utc_midnight(datetime.now(timezone.utc))
                    )
                },
            )

    return dependency
