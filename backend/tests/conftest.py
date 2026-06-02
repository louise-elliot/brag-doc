from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user, UserClaims
from main import app, get_anthropic_client


@pytest.fixture
def mock_client():
    """Replace the Anthropic dependency with a MagicMock for the duration of the test."""
    client = MagicMock()
    app.dependency_overrides[get_anthropic_client] = lambda: client
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def http_client():
    return TestClient(app)


@pytest.fixture
def authed_user():
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", email="test@example.com"
    )
    yield UserClaims(user_id="test-user", email="test@example.com")
    app.dependency_overrides.pop(get_current_user, None)
