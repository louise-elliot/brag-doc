import json
from unittest.mock import MagicMock


def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)]
    )


SAMPLE_TURN_BODY = {
    "entry_text": "I just helped a bit with the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [],
}


SAMPLE_REFRAME_BODY = {
    "entry_text": "I just helped a bit with the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [
        {"role": "coach", "text": "Who used it?", "notes": ["missing-audience"]},
        {"role": "user", "text": "The platform team — about 40 engineers"},
    ],
}


class TestCoachTurnEndpoint:
    def test_returns_text_and_notes(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "text": "Who specifically benefited?",
                    "notes": ["hedging", "missing-audience"],
                }
            ),
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Who specifically benefited?"
        assert data["notes"] == ["hedging", "missing-audience"]

    def test_passes_entry_prompt_tags_and_conversation_to_model(
        self, mock_client, http_client
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {
            "entry_text": "Led the migration",
            "prompt": "What did you ship?",
            "tags": ["technical", "leadership"],
            "conversation": [
                {"role": "coach", "text": "Who used it?", "notes": ["missing-audience"]},
                {"role": "user", "text": "The platform team"},
            ],
        }

        http_client.post("/coach/turn", json=body)

        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert "confidence coach for women in tech" in kwargs["system"]
        user_content = kwargs["messages"][0]["content"]
        assert "Led the migration" in user_content
        assert "What did you ship?" in user_content
        assert "technical, leadership" in user_content
        assert "Coach: Who used it?" in user_content
        assert "User: The platform team" in user_content

    def test_strips_markdown_code_fences(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            '```json\n{"text": "ok", "notes": ["hedging"]}\n```',
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        assert response.json()["notes"] == ["hedging"]

    def test_returns_422_when_required_fields_missing(self, mock_client, http_client):
        response = http_client.post("/coach/turn", json={"entry_text": "x"})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception("LEAKED_KEY_XYZ")

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 500
        assert response.json() == {"error": "Coach turn failed"}
        assert "LEAKED_KEY_XYZ" not in response.text


class TestCoachReframeEndpoint:
    def test_returns_reframed_and_notes(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "reframed": "I led the migration that unblocked 40 platform engineers",
                    "notes": ["hedging", "missing-audience"],
                }
            ),
        )

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 200
        data = response.json()
        assert "40 platform engineers" in data["reframed"]
        assert data["notes"] == ["hedging", "missing-audience"]

    def test_passes_full_conversation_to_model(self, mock_client, http_client):
        _mock_text_response(
            mock_client, json.dumps({"reframed": "ok", "notes": []})
        )

        http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        user_content = mock_client.messages.create.call_args.kwargs["messages"][0][
            "content"
        ]
        assert "Coach: Who used it?" in user_content
        assert "User: The platform team — about 40 engineers" in user_content

    def test_strips_markdown_code_fences(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            '```json\n{"reframed": "ok", "notes": []}\n```',
        )

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 200
        assert response.json()["reframed"] == "ok"

    def test_returns_422_when_required_fields_missing(self, mock_client, http_client):
        response = http_client.post("/coach/reframe", json={"entry_text": "x"})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception("LEAKED_KEY_ABC")

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 500
        assert response.json() == {"error": "Coach reframe failed"}
        assert "LEAKED_KEY_ABC" not in response.text

    def test_uses_reframe_system_prompt(self, mock_client, http_client):
        _mock_text_response(
            mock_client, json.dumps({"reframed": "ok", "notes": []})
        )

        http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "produce a reframed version" in system
