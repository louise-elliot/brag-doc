import time

import jwt
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from auth import get_current_user, UserClaims


# Generate a key pair for tests
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_pem = _private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)


def _make_token(claims: dict, kid: str = "test-kid", expired: bool = False) -> str:
    payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "iat": int(time.time()) - 60,
        "exp": int(time.time()) - 10 if expired else int(time.time()) + 600,
        **claims,
    }
    return jwt.encode(payload, _pem, algorithm="RS256", headers={"kid": kid})


@pytest.fixture
def app_with_auth():
    app = FastAPI()

    @app.get("/protected")
    def protected(user: UserClaims = Depends(get_current_user)):
        return {"user_id": user.user_id}

    return app


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    """Patch the JWKS fetcher to return our test public key."""
    from auth import _jwks_cache
    _jwks_cache.clear()

    public_key = _private_key.public_key()
    import base64
    numbers = public_key.public_numbers()

    def b64u(n: int) -> str:
        b = n.to_bytes((n.bit_length() + 7) // 8, "big")
        return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

    jwk = {
        "kty": "RSA",
        "kid": "test-kid",
        "alg": "RS256",
        "use": "sig",
        "n": b64u(numbers.n),
        "e": b64u(numbers.e),
    }

    monkeypatch.setattr("auth._fetch_jwks", lambda: {"keys": [jwk]})
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    yield


def test_valid_token_returns_200(app_with_auth):
    token = _make_token({})
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": "user-123"}


def test_missing_token_returns_401(app_with_auth):
    client = TestClient(app_with_auth)
    res = client.get("/protected")
    assert res.status_code == 401


def test_malformed_token_returns_401(app_with_auth):
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401


def test_expired_token_returns_401(app_with_auth):
    token = _make_token({}, expired=True)
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_unknown_kid_returns_401(app_with_auth):
    token = _make_token({}, kid="other-kid")
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
