from unittest.mock import patch

from utils import OutputGuardrailError

SAMPLE_REFRAME_BODY = {
    "entry_text": "I just helped a bit with the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [],
}


class TestErrorCapture:
    def test_captures_on_unexpected_failure(
        self, mock_client, http_client, authed_user
    ):
        with patch("main.capture_exception") as mock_cap, patch(
            "main.coach_reframe", side_effect=RuntimeError("anthropic down")
        ):
            response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)
        assert response.status_code == 500
        mock_cap.assert_called_once()

    def test_does_not_capture_on_guardrail_trip(
        self, mock_client, http_client, authed_user
    ):
        with patch("main.capture_exception") as mock_cap, patch(
            "main.coach_reframe", side_effect=OutputGuardrailError()
        ):
            response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)
        assert response.status_code == 200
        mock_cap.assert_not_called()
