import json
from unittest.mock import MagicMock

from coach import UserContext, build_coach_system_prompt
from prompts import COACH_STYLE_FRAGMENTS, COACH_TURN_SYSTEM_PROMPT


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
        {"role": "coach", "text": "Who used it?", "notes": ["vague-language"]},
        {"role": "user", "text": "The platform team — about 40 engineers"},
    ],
}


class TestCoachTurnEndpoint:
    def test_returns_text_and_notes(self, mock_client, http_client, authed_user):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "text": "Who specifically benefited?",
                    "notes": ["minimising-language", "vague-language"],
                }
            ),
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Who specifically benefited?"
        assert data["notes"] == ["minimising-language", "vague-language"]

    def test_passes_entry_prompt_tags_and_conversation_to_model(
        self, mock_client, http_client, authed_user
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {
            "entry_text": "Led the migration",
            "prompt": "What did you ship?",
            "tags": ["technical", "leadership"],
            "conversation": [
                {"role": "coach", "text": "Who used it?", "notes": ["vague-language"]},
                {"role": "user", "text": "The platform team"},
            ],
        }

        http_client.post("/coach/turn", json=body)

        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert "career coach for women in tech" in kwargs["system"]
        user_content = kwargs["messages"][0]["content"]
        assert "Led the migration" in user_content
        assert "What did you ship?" in user_content
        assert "technical, leadership" in user_content
        assert "Coach: Who used it?" in user_content
        assert "User: The platform team" in user_content

    def test_strips_markdown_code_fences(self, mock_client, http_client, authed_user):
        _mock_text_response(
            mock_client,
            '```json\n{"text": "ok", "notes": ["minimising-language"]}\n```',
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        assert response.json()["notes"] == ["minimising-language"]

    def test_returns_422_when_required_fields_missing(self, mock_client, http_client, authed_user):
        response = http_client.post("/coach/turn", json={"entry_text": "x"})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client, authed_user
    ):
        mock_client.messages.create.side_effect = Exception("LEAKED_KEY_XYZ")

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 500
        assert response.json() == {"error": "Coach turn failed"}
        assert "LEAKED_KEY_XYZ" not in response.text


class TestCoachReframeEndpoint:
    def test_returns_reframed_and_notes(self, mock_client, http_client, authed_user):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "reframed": "I led the migration that unblocked 40 platform engineers",
                    "notes": ["minimising-language", "vague-language"],
                }
            ),
        )

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 200
        data = response.json()
        assert "40 platform engineers" in data["reframed"]
        assert data["notes"] == ["minimising-language", "vague-language"]

    def test_passes_full_conversation_to_model(self, mock_client, http_client, authed_user):
        _mock_text_response(
            mock_client, json.dumps({"reframed": "ok", "notes": []})
        )

        http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        user_content = mock_client.messages.create.call_args.kwargs["messages"][0][
            "content"
        ]
        assert "Coach: Who used it?" in user_content
        assert "User: The platform team — about 40 engineers" in user_content

    def test_strips_markdown_code_fences(self, mock_client, http_client, authed_user):
        _mock_text_response(
            mock_client,
            '```json\n{"reframed": "ok", "notes": []}\n```',
        )

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 200
        assert response.json()["reframed"] == "ok"

    def test_returns_422_when_required_fields_missing(self, mock_client, http_client, authed_user):
        response = http_client.post("/coach/reframe", json={"entry_text": "x"})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client, authed_user
    ):
        mock_client.messages.create.side_effect = Exception("LEAKED_KEY_ABC")

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 500
        assert response.json() == {"error": "Coach reframe failed"}
        assert "LEAKED_KEY_ABC" not in response.text

    def test_uses_reframe_system_prompt(self, mock_client, http_client, authed_user):
        _mock_text_response(
            mock_client, json.dumps({"reframed": "ok", "notes": []})
        )

        http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "produce a reframed version" in system


class TestBuildCoachSystemPrompt:
    def test_appends_the_fragment_for_the_requested_style(self):
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "hype-woman", None
        )
        assert COACH_STYLE_FRAGMENTS["hype-woman"] in result

    def test_keeps_the_underlying_coaching_rules(self):
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", None
        )
        assert "career coach for women in tech" in result

    def test_includes_the_about_the_user_block_when_context_provided(self):
        ctx = UserContext(
            headline="Senior backend engineer",
            notes="Working towards staff promotion",
        )
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", ctx
        )
        assert "## About the user:" in result
        assert "Senior backend engineer" in result
        assert "Working towards staff promotion" in result

    def test_omits_the_block_when_context_is_none(self):
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", None
        )
        assert "## About the user:" not in result

    def test_omits_the_block_when_both_fields_are_whitespace(self):
        ctx = UserContext(headline="   ", notes="\n\n")
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", ctx
        )
        assert "## About the user:" not in result


class TestCoachTurnEndpointPersonalisation:
    def test_uses_the_requested_style_fragment_in_the_system_prompt(
        self, mock_client, http_client, authed_user
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {**SAMPLE_TURN_BODY, "coaching_style": "direct-challenger"}

        http_client.post("/coach/turn", json=body)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert COACH_STYLE_FRAGMENTS["direct-challenger"] in system

    def test_includes_user_context_block_when_provided(
        self, mock_client, http_client, authed_user
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {
            **SAMPLE_TURN_BODY,
            "user_context": {
                "headline": "Staff PM",
                "notes": "promo case to director",
            },
        }

        http_client.post("/coach/turn", json=body)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Staff PM" in system
        assert "promo case to director" in system

    def test_rejects_unknown_coaching_style(self, mock_client, http_client, authed_user):
        body = {**SAMPLE_TURN_BODY, "coaching_style": "drill-sergeant"}
        response = http_client.post("/coach/turn", json=body)
        assert response.status_code == 422
