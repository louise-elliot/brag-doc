from unittest.mock import MagicMock


def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)]
    )


class TestReframeEndpoint:
    def test_returns_reframed_text(self, mock_client, http_client):
        _mock_text_response(mock_client, "I resolved a critical production issue")

        response = http_client.post(
            "/reframe", json={"text": "I just helped fix a bug"}
        )

        assert response.status_code == 200
        assert response.json() == {"reframed": "I resolved a critical production issue"}

    def test_returns_422_when_text_missing(self, mock_client, http_client):
        response = http_client.post("/reframe", json={})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception(
            "UPSTREAM_SECRET_KEY_XYZ leaked"
        )

        response = http_client.post("/reframe", json={"text": "hello"})

        assert response.status_code == 500
        body = response.json()
        assert body == {"error": "Reframe failed"}
        assert "UPSTREAM_SECRET_KEY_XYZ" not in response.text

    def test_calls_anthropic_with_reframe_system_prompt(
        self, mock_client, http_client
    ):
        _mock_text_response(mock_client, "out")
        http_client.post("/reframe", json={"text": "in"})

        kwargs = mock_client.messages.create.call_args.kwargs
        assert "confidence coach for women in tech" in kwargs["system"]
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert kwargs["messages"] == [{"role": "user", "content": "in"}]
