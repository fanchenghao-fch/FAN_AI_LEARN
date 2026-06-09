"""Tests for quiz validation chain.

Tests the validation chain creation and input building.
"""

from app.chains.quiz_validation import (
    create_validation_chain,
    build_validation_input,
)
from app.models.quiz import ValidationResult


class TestBuildValidationInput:
    """Test the validation input builder."""

    def test_builds_input_with_questions(self):
        """Should build input dict with JSON-formatted questions."""
        questions = [
            {
                "id": "q1",
                "content": "测试题目",
                "correct_answer": "A",
            }
        ]

        result = build_validation_input(questions)

        assert "questions_json" in result
        assert "format_instructions" in result
        assert "测试题目" in result["questions_json"]

    def test_empty_questions_list(self):
        """Should handle empty questions list."""
        result = build_validation_input([])

        assert "questions_json" in result
        assert "[]" in result["questions_json"]


class TestCreateValidationChain:
    """Test validation chain creation."""

    def test_creates_chain_with_default_model(self):
        """Should create a chain with default DeepSeek Flash model."""
        chain = create_validation_chain()

        assert chain is not None

    def test_creates_chain_with_custom_temperature(self):
        """Should accept custom temperature for precise validation."""
        chain = create_validation_chain(temperature=0.05)

        assert chain is not None


class TestValidationResultModel:
    """Test the ValidationResult Pydantic model."""

    def test_valid_result_with_no_issues(self):
        """Should accept valid result with no issues."""
        data = {"valid": True, "issues": []}

        result = ValidationResult(**data)
        assert result.valid is True
        assert len(result.issues) == 0

    def test_invalid_result_with_issues(self):
        """Should accept invalid result with listed issues."""
        data = {
            "valid": False,
            "issues": [
                {
                    "question_id": "q1",
                    "problem": "正确答案不准确",
                    "suggestion": "应该改为 C",
                }
            ],
        }

        result = ValidationResult(**data)
        assert result.valid is False
        assert len(result.issues) == 1
        assert result.issues[0].question_id == "q1"

    def test_default_issues_is_empty(self):
        """Default issues should be an empty list."""
        data = {"valid": True}

        result = ValidationResult(**data)
        assert result.issues == []
