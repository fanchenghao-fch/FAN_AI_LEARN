"""API Request/Response models — separate from core domain models."""

from typing import Optional, Literal

from pydantic import BaseModel, Field


# ── Progress / Response type aliases ──────────────────────────

# Stage values for quiz generation progress events
ProgressStage = Literal["searching", "generating", "validating"]

# Search method identifiers (which backend performed the search)
SearchMethod = Literal[
    "tavily_search",
    "tavily_extract",
    "deepseek_native",
    "firecrawl",
    "none",
]

# Search status emitted in API response
SearchStatus = Literal["success", "timeout", "disabled", "error"]


class QuizGenerateRequest(BaseModel):
    """Request body for POST /api/quiz/generate."""

    knowledge_input: str = Field(
        description="User's knowledge input: text description, document content, etc.",
        min_length=1,
        max_length=2000,
    )
    input_type: str = Field(
        default="text",
        description="Input type: text | document | url",
        pattern="^(text|document|url)$",
    )
    question_count: int = Field(
        default=10,
        description="Number of questions to generate",
        ge=5,
        le=50,
    )
    difficulty: str = Field(
        default="auto",
        description="Target difficulty: easy | medium | hard | auto",
        pattern="^(easy|medium|hard|auto)$",
    )
    question_types: list[str] = Field(
        default=["choice"],
        description="Question types to include",
    )
    enable_search: bool = Field(
        default=True,
        description="Whether to enable web search for knowledge enrichment",
    )


class QuizAnalyzeRequest(BaseModel):
    """Request body for POST /api/quiz/analyze."""

    quiz_id: str
    title: str | None = Field(
        default=None,
        description="Quiz title from generation (e.g. 'Python基础闯关')",
    )
    knowledge_input: str | None = Field(
        default=None,
        description="Original knowledge input text (e.g. 'Python面试高频题')",
    )
    knowledge_domain: str | None = Field(
        default=None,
        description="Knowledge domain from quiz generation (e.g. 'Python编程基础')",
    )
    questions: list[dict] = Field(description="Full question list with correct answers")
    answers: list[dict] = Field(
        description="User's answers: [{question_id, user_answer, is_correct, time_spent}]"
    )
    total_time: int = Field(description="Total quiz time in seconds")


class APIResponse(BaseModel):
    """Standard API response wrapper."""

    code: int = 0
    message: str = "ok"
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Standard error response."""

    code: int
    message: str
    detail: Optional[str] = None
