import json
from unittest.mock import MagicMock


def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)]
    )


SAMPLE_ENTRY = {
    "id": "1",
    "date": "2026-04-01",
    "prompt": "What impact?",
    "original": "Led the review",
    "reframed": None,
    "tags": ["leadership"],
    "createdAt": "2026-04-01T18:00:00Z",
}


def _post(http_client, body):
    return http_client.post("/generate-brag-doc", json=body)


class TestBragDocEndpoint:
    def test_returns_grouped_bullet_points(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "bullets": [
                        {
                            "tag": "leadership",
                            "points": ["Drove architectural decisions across the team"],
                        }
                    ]
                }
            ),
        )

        response = _post(http_client, {"entries": [SAMPLE_ENTRY]})

        assert response.status_code == 200
        data = response.json()
        assert len(data["bullets"]) == 1
        assert data["bullets"][0]["tag"] == "leadership"
        assert (
            "Drove architectural decisions across the team"
            in data["bullets"][0]["points"]
        )

    def test_returns_422_when_entries_missing(self, mock_client, http_client):
        response = _post(http_client, {})
        assert response.status_code == 422

    def test_defaults_to_tag_grouping(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": []})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Group bullets by tag category" in system

    def test_uses_month_grouping_when_groupBy_is_month(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": [], "groupBy": "month"})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Group bullets by calendar month" in system
        assert "Month YYYY" in system

    def test_uses_chronological_when_groupBy_is_chronological(
        self, mock_client, http_client
    ):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": [], "groupBy": "chronological"})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "single group" in system
        assert "empty string" in system

    def test_appends_userPrompt_guidance_when_provided(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(
            http_client,
            {
                "entries": [],
                "userPrompt": "emphasize cross-functional collaboration",
            },
        )

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "emphasize cross-functional collaboration" in system
        assert "additional guidance" in system

    def test_does_not_append_guidance_when_userPrompt_is_whitespace(
        self, mock_client, http_client
    ):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": [], "userPrompt": "   "})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "additional guidance" not in system

    def test_strips_markdown_code_fences_from_anthropic_response(
        self, mock_client, http_client
    ):
        fenced = '```json\n{"bullets": [{"tag": "x", "points": ["y"]}]}\n```'
        _mock_text_response(mock_client, fenced)

        response = _post(http_client, {"entries": []})

        assert response.status_code == 200
        assert response.json()["bullets"][0]["tag"] == "x"

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception("INTERNAL_KEY_ABC leaked")

        response = _post(http_client, {"entries": []})

        assert response.status_code == 500
        assert response.json() == {"error": "Brag doc generation failed"}
        assert "INTERNAL_KEY_ABC" not in response.text

    def test_serializes_entries_into_user_message(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        second_entry = {
            **SAMPLE_ENTRY,
            "id": "2",
            "date": "2026-04-15",
            "tags": ["technical", "mentoring"],
            "original": "Paired with junior on tricky migration",
        }

        _post(http_client, {"entries": [SAMPLE_ENTRY, second_entry]})

        user_content = mock_client.messages.create.call_args.kwargs["messages"][0][
            "content"
        ]
        assert "[2026-04-01] [leadership] Led the review" in user_content
        assert (
            "[2026-04-15] [technical, mentoring] Paired with junior on tricky migration"
            in user_content
        )
