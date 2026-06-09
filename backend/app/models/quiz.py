"""Core Pydantic data models for the AI Quiz Platform.

These models are shared between the FastAPI layer and LangChain chains,
ensuring end-to-end type safety for AI-generated structured output.
"""

from enum import Enum
from typing import Optional, ClassVar

from pydantic import BaseModel, Field


class QuestionType(str, Enum):
    """Supported question types."""

    CHOICE = "choice"
    TRUEFALSE = "truefalse"
    FILL = "fill"


class Difficulty(str, Enum):
    """Question difficulty levels."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ── Core Quiz Models ──────────────────────────────────────────


class Option(BaseModel):
    """A single answer option (A/B/C/D)."""

    key: str = Field(description="Option key: A, B, C, or D")
    text: str = Field(description="Option text content")


class Question(BaseModel):
    """A single quiz question."""

    id: str = Field(description="Unique question identifier, e.g. q1, q2")
    type: QuestionType = Field(description="Question type")
    content: str = Field(description="Question text content")
    options: Optional[list[Option]] = Field(
        default=None, description="Answer options (for choice type)"
    )
    correct_answer: str = Field(description="The correct answer")
    explanation: str = Field(description="Detailed explanation, 80-150 characters")
    source: Optional[str] = Field(default=None, description="Knowledge source reference")
    difficulty: Difficulty = Field(description="Difficulty level")
    image_url: Optional[str] = Field(default=None, description="Optional illustration URL")


class QuizOutput(BaseModel):
    """Structured output from the quiz generation chain."""

    title: str = Field(description="Quiz title, concise and engaging, ≤15 characters")
    knowledge_domain: str = Field(description="Knowledge domain classification")
    questions: list[Question] = Field(description="Generated question list")


# ── Quiz Session Models ───────────────────────────────────────


class UserAnswer(BaseModel):
    """A single answer submitted by the user."""

    question_id: str
    user_answer: str
    is_correct: bool
    time_spent: int = Field(description="Time spent on this question in seconds")


class QuizSession(BaseModel):
    """In-memory quiz session tracking user progress."""

    quiz_id: str
    title: str
    knowledge_domain: str
    questions: list[Question]
    current_index: int = 0
    answers: list[UserAnswer] = []
    combo: int = 0
    max_combo: int = 0
    status: str = "in_progress"


# ── Result / Analysis Models ──────────────────────────────────


class WrongQuestionDetail(BaseModel):
    """Detailed analysis of a wrong answer."""

    question_id: str
    content: str
    user_answer: str
    correct_answer: str
    explanation: str


class MasteryRadar(BaseModel):
    """Knowledge mastery radar chart data — dimension → score (0-1)."""

    dimensions: dict[str, float] = Field(
        description="Knowledge dimension to mastery score (0-1) mapping"
    )


class QuizResult(BaseModel):
    """Final quiz result displayed to the user."""

    quiz_id: str
    title: str
    score: int
    total_questions: int
    accuracy: float
    total_time: int
    knowledge_summary: list[str] = Field(
        description="3-5 key knowledge takeaways"
    )
    wrong_questions: list[WrongQuestionDetail]
    mastery_radar: dict[str, float] = Field(
        description="Knowledge dimension → mastery score mapping"
    )
    study_suggestion: str = Field(
        description="Next-step learning suggestion, 80-150 characters"
    )


# ── Validation Models ─────────────────────────────────────────


class ValidationIssue(BaseModel):
    """A single issue found during question validation."""

    question_id: str
    problem: str = Field(description="Description of the problem")
    suggestion: str = Field(description="Suggested correction")


class ValidationResult(BaseModel):
    """Result of the validation chain."""

    valid: bool
    issues: list[ValidationIssue] = []


# ── Analysis Models ───────────────────────────────────────────


class AnalysisOutput(BaseModel):
    """Structured output from the result analysis chain."""

    knowledge_summary: list[str] = Field(
        description="3-5 key knowledge takeaways"
    )
    wrong_questions: list[WrongQuestionDetail]
    mastery_radar: MasteryRadar
    study_suggestion: str = Field(
        description="Next-step learning suggestion, 80-150 characters"
    )
