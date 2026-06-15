from utils import (
    OutputGuardrailError,
    canary_instruction,
    canary_leaked,
    make_canary,
    neutralize_delimiters,
)


def test_strips_opening_and_closing_delimiter_tags():
    text = "before <user_content>injected</user_content> after"
    assert neutralize_delimiters(text) == "before injected after"


def test_strips_all_guardrail_tag_names():
    text = "<user_about></user_about><entries></entries><user_guidance></user_guidance>"
    assert neutralize_delimiters(text) == ""


def test_is_case_insensitive():
    assert neutralize_delimiters("</USER_CONTENT>") == ""


def test_leaves_normal_prose_and_unrelated_angle_brackets_untouched():
    text = "I shipped v2 < v3 and noted a > b in the <div> review"
    assert neutralize_delimiters(text) == text


def test_make_canary_returns_unique_hex_tokens():
    a, b = make_canary(), make_canary()
    assert a != b
    assert len(a) == 32 and all(c in "0123456789abcdef" for c in a)


def test_canary_instruction_embeds_the_token():
    canary = "deadbeef"
    text = canary_instruction(canary)
    assert "deadbeef" in text
    assert "never reveal" in text.lower()


def test_canary_leaked_detects_token_in_output():
    assert canary_leaked("here is the token abc123", "abc123") is True


def test_canary_leaked_false_when_absent():
    assert canary_leaked('{"text": "clean response", "notes": []}', "abc123") is False


def test_output_guardrail_error_is_an_exception():
    assert issubclass(OutputGuardrailError, Exception)
