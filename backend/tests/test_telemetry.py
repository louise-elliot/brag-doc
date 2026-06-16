import telemetry


class TestCostUsd:
    def test_haiku_known_rates(self):
        # 1,000,000 input @ $1 + 1,000,000 output @ $5 = $6.00
        assert telemetry.cost_usd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000) == 6.0

    def test_small_request(self):
        # 1200 in @ $1/M + 150 out @ $5/M = 0.0012 + 0.00075 = 0.00195
        assert telemetry.cost_usd("claude-haiku-4-5", 1200, 150) == 0.00195

    def test_unknown_model_uses_fallback_rate(self):
        # falls back to Haiku rate rather than zero-costing
        assert telemetry.cost_usd("some-future-model", 1_000_000, 0) == 1.0


class TestLlmUsage:
    def test_holds_token_counts(self):
        u = telemetry.LlmUsage(input_tokens=10, output_tokens=20)
        assert (u.input_tokens, u.output_tokens) == (10, 20)
