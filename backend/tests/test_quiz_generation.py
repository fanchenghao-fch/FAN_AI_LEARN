"""Tests for quiz generation chain.

Tests the prompt building, chain creation, and input formatting.
"""

import pytest
from app.chains.quiz_generation import (
    create_quiz_generation_chain,
    build_generation_input,
)
from app.models.quiz import QuizOutput


class TestBuildGenerationInput:
    """Test the input builder for quiz generation chain."""

    def test_default_parameters(self):
        """Should use sensible defaults for optional parameters."""
        result = build_generation_input("Python 基础")

        assert result["knowledge_input"] == "Python 基础"
        assert result["question_count"] == 10
        assert result["difficulty"] == "auto"
        assert "选择题" in result["question_types"]
        assert "format_instructions" in result

    def test_custom_parameters(self):
        """Should accept custom parameters."""
        result = build_generation_input(
            knowledge_input="中国近代史",
            question_count=20,
            question_types=["选择题", "判断题"],
            difficulty="hard",
        )

        assert result["question_count"] == 20
        assert result["difficulty"] == "hard"
        assert "选择题" in result["question_types"]
        assert "判断题" in result["question_types"]

    def test_knowledge_input_is_preserved(self):
        """Knowledge input text should be passed through unchanged."""
        long_input = "Python 编程语言中的面向对象编程概念" * 5
        result = build_generation_input(long_input)

        assert result["knowledge_input"] == long_input

    def test_format_instructions_is_non_empty(self):
        """Format instructions should be a non-empty string."""
        result = build_generation_input("test")

        assert len(result["format_instructions"]) > 0


class TestCreateChain:
    """Test chain creation."""

    def test_creates_chain_with_default_model(self):
        """Should create a chain with default DeepSeek Pro model."""
        chain = create_quiz_generation_chain(streaming=False)

        assert chain is not None

    def test_creates_chain_with_custom_model(self):
        """Should accept custom model name."""
        chain = create_quiz_generation_chain(
            model_name="deepseek-v4-pro",
            streaming=False,
        )

        assert chain is not None

    def test_creates_chain_with_custom_temperature(self):
        """Should accept custom temperature."""
        chain = create_quiz_generation_chain(
            temperature=0.5,
            streaming=False,
        )

        assert chain is not None


class TestQuizOutputModel:
    """Test the QuizOutput Pydantic model validation."""

    def test_valid_quiz_output(self):
        """Should accept valid quiz output data."""
        data = {
            "title": "Python基础闯关",
            "knowledge_domain": "Python编程",
            "questions": [
                {
                    "id": "q1",
                    "type": "choice",
                    "content": "Python 中 `print(type(5))` 的输出是？",
                    "options": [
                        {"key": "A", "text": "<class 'int'>"},
                        {"key": "B", "text": "<class 'float'>"},
                        {"key": "C", "text": "<class 'str'>"},
                        {"key": "D", "text": "<class 'bool'>"},
                    ],
                    "correct_answer": "A",
                    "explanation": "5 是整数类型，type(5) 返回 <class 'int'>。",
                    "source": "Python 官方文档",
                    "difficulty": "easy",
                }
            ],
        }

        quiz = QuizOutput(**data)
        assert quiz.title == "Python基础闯关"
        assert len(quiz.questions) == 1
        assert quiz.questions[0].difficulty == "easy"

    def test_empty_questions_list(self):
        """Should accept empty questions list."""
        data = {
            "title": "空测试",
            "knowledge_domain": "测试",
            "questions": [],
        }

        quiz = QuizOutput(**data)
        assert len(quiz.questions) == 0

    def test_missing_required_field_raises_error(self):
        """Missing required fields should raise validation error."""
        data = {
            "title": "不完整的闯关",
        }

        with pytest.raises(Exception):
            QuizOutput(**data)
