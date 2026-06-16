"""Admin cost dashboard API, gated by an email allowlist."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import UserClaims, get_current_user
from budget import _daily_budget_usd

admin_router = APIRouter(prefix="/admin")


def _admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def require_admin(user: UserClaims = Depends(get_current_user)) -> UserClaims:
    if (user.email or "").lower() not in _admin_emails():
        raise HTTPException(status_code=403, detail="forbidden")
    return user


def _rpc(name: str, payload: dict):
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    resp = httpx.post(
        f"{url}/rest/v1/rpc/{name}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()


@admin_router.get("/cost/summary")
def cost_summary(
    days: int = Query(30, ge=1, le=365),
    _admin: UserClaims = Depends(require_admin),
):
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=days - 1)).isoformat()
    return {
        "budget_usd": _daily_budget_usd(),
        "today_spend_usd": float(_rpc("daily_spend_usd", {"p_day": today.isoformat()})),
        "daily": _rpc("daily_cost_series", {"p_days": days}),
        "breakdown": _rpc("cost_breakdown", {"p_since": since}),
    }
