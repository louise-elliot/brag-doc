"""JWT verification against Supabase JWKS."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)

_jwks_cache: dict[str, Any] = {}
_JWKS_TTL_SECONDS = 600


@dataclass(frozen=True)
class UserClaims:
    user_id: str
    email: str | None


def _fetch_jwks() -> dict[str, Any]:
    url = os.environ["SUPABASE_JWKS_URL"]
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    return resp.json()


def _get_jwks(force: bool = False) -> dict[str, Any]:
    now = time.time()
    if not force and _jwks_cache.get("fetched_at", 0) + _JWKS_TTL_SECONDS > now:
        return _jwks_cache["jwks"]
    jwks = _fetch_jwks()
    _jwks_cache["jwks"] = jwks
    _jwks_cache["fetched_at"] = now
    return jwks


def _find_key(jwks: dict[str, Any], kid: str) -> dict[str, Any] | None:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


def _verify(token: str) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="invalid token")

    jwks = _get_jwks()
    jwk = _find_key(jwks, kid)
    if jwk is None:
        # Maybe JWKS rotated; refresh once and retry.
        jwks = _get_jwks(force=True)
        jwk = _find_key(jwks, kid)
        if jwk is None:
            raise HTTPException(status_code=401, detail="invalid token")

    public_key = jwt.PyJWK(jwk).key
    audience = os.environ.get("SUPABASE_JWT_AUDIENCE", "authenticated")
    try:
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256", "ES256"],
            audience=audience,
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")
    return claims


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserClaims:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="missing token")
    claims = _verify(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid token")
    return UserClaims(user_id=user_id, email=claims.get("email"))
