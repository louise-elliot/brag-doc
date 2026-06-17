from unittest.mock import patch

from sentry_setup import init_sentry, scrub_event, capture_exception


class TestScrubEvent:
    def test_removes_request_block(self):
        event = {"request": {"data": "secret journal text"}, "level": "error"}
        result = scrub_event(event, {})
        assert "request" not in result

    def test_reduces_user_to_id_only(self):
        event = {"user": {"id": "u1", "email": "a@b.com", "username": "alice"}}
        result = scrub_event(event, {})
        assert result["user"] == {"id": "u1"}

    def test_no_user_key_is_left_untouched(self):
        event = {"level": "error"}
        result = scrub_event(event, {})
        assert "user" not in result


class TestInitSentry:
    def test_does_not_init_without_dsn(self, monkeypatch):
        monkeypatch.delenv("SENTRY_DSN", raising=False)
        with patch("sentry_setup.sentry_sdk.init") as mock_init:
            init_sentry()
            mock_init.assert_not_called()

    def test_inits_with_dsn_and_strict_privacy(self, monkeypatch):
        monkeypatch.setenv("SENTRY_DSN", "https://example@sentry.io/1")
        with patch("sentry_setup.sentry_sdk.init") as mock_init:
            init_sentry()
            mock_init.assert_called_once()
            kwargs = mock_init.call_args.kwargs
            assert kwargs["send_default_pii"] is False
            assert kwargs["include_local_variables"] is False
            assert kwargs["max_request_body_size"] == "never"
            assert kwargs["before_send"] is scrub_event


class TestCaptureException:
    def test_forwards_to_sdk(self):
        with patch("sentry_setup.sentry_sdk.capture_exception") as mock_cap:
            exc = ValueError("boom")
            capture_exception(exc)
            mock_cap.assert_called_once_with(exc)
