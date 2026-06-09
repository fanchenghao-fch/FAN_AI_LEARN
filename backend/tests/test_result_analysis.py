"""Tests for result analysis chain.

Tests the analysis chain creation and input building.
"""

import pytest
from app.chains.result_analysis import (
    create_analysis_chain,
    build_analysis_input,
)
from app.models.quiz import AnalysisOutput


class TestBuildAnalysisInput:
    """Test the analysis input builder."""

    def test_builds_input_with_quiz_data(self):
        """Should build input dict with quiz data."""
        quiz_data = [
            {
                "question_id": "q1",
                "content": "测试题目",
                "user_answer": "A",
                "correct_answer": "A",
                "is_correct": True,
                "time_spent": 5,
                "explanation": "解析内容",
                "difficulty": "easy",
            }
        ]

        result = build_analysis_input(
            quiz_data=quiz_data,
            score=1,
            total_questions=1,
            total_time=30,
            knowledge_domain="测试领域",
        )

        assert result["total_questions"] == 1
        assert result["score"] == 1
        assert result["accuracy"] == 1.0
        assert result["total_time"] == 30
        assert result["knowledge_domain"] == "测试领域"
        assert "quiz_data" in result
        assert "format_instructions" in result

    def test_calculates_accuracy_correctly(self):
        """Should calculate accuracy as score/total."""
        result = build_analysis_input(
            quiz_data=[],
            score=3,
            total_questions=10,
            total_time=60,
            knowledge_domain="测试",
        )

        assert result["accuracy"] == 0.3

    def test_zero_questions_handles_division_by_zero(self):
        """Should handle zero total questions gracefully."""
        result = build_analysis_input(
            quiz_data=[],
            score=0,
            total_questions=0,
            total_time=0,
            knowledge_domain="测试",
        )

        assert result["accuracy"] == 0.0


class TestCreateAnalysisChain:
    """Test analysis chain creation."""

    def test_creates_chain_with_default_model(self):
        """Should create a chain with default DeepSeek Pro model."""
        chain = create_analysis_chain()

        assert chain is not None


class TestAnalysisOutputModel:
    """Test the AnalysisOutput Pydantic model."""

    def test_valid_analysis_output(self):
        """Should accept valid analysis output."""
        data = {
            "knowledge_summary": ["要点一：Python 是动态类型语言", "要点二：变量无需声明类型"],
            "wrong_questions": [
                {
                    "question_id": "q1",
                    "content": "测试",
                    "user_answer": "A",
                    "correct_answer": "C",
                    "explanation": "详细解析",
                }
            ],
            "mastery_radar": {"dimensions": {"数据类型": 0.8, "控制流": 0.6}},
            "study_suggestion": "建议重点练习控制流相关题目",
        }

        analysis = AnalysisOutput(**data)
        assert len(analysis.knowledge_summary) == 2
        assert len(analysis.wrong_questions) == 1
        assert analysis.mastery_radar.dimensions["数据类型"] == 0.8

    def test_missing_mastery_radar_raises_error(self):
        """Mastery radar is required."""
        data = {
            "knowledge_summary": ["要点"],
            "wrong_questions": [],
            "study_suggestion": "建议",
        }

        with pytest.raises(Exception):
            AnalysisOutput(**data)
