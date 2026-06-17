"""Sentry initialization and strict event scrubbing for the backend.

Production only: init is a no-op unless SENTRY_DSN is set. No journal content
or user email may reach Sentry.
"""
from __future__ import annotations

import os

import sentry_sdk

from telemetry import request_id_var, user_id_var


def scrub_event(event: dict, hint: dict) -> dict:
    """before_send hook: drop request data, reduce user to id only."""
    event.pop("request", None)
    user = event.get("user")
    if user is not None:
        event["user"] = {"id": user.get("id")}
    return event


def init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=scrub_event,
    )


def capture_exception(exc: BaseException) -> None:
    """Capture an exception, correlating it with the request log via request_id."""
    scope = sentry_sdk.get_current_scope()
    scope.set_tag("request_id", request_id_var.get())
    user_id = user_id_var.get()
    if user_id is not None:
        scope.set_user({"id": user_id})
    sentry_sdk.capture_exception(exc)
