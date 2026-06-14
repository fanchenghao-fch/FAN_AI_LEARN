"""Domain validation chain using DeepSeek Flash.

Phase 3 of the 3-phase quiz generation pipeline.

Validates that generated questions belong to the user's specified
knowledge domain, catching off-topic / hallucinated questions.

Uses the same ValidationResult model as the existing answer-validation chain,
but with a different prompt focused on domain relevance.
"""

import json
import logging

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.config import settings
from app.models.quiz import ValidationResult
from app.prompts.domain_validation import (
    DOMAIN_VALIDATION_SYSTEM,
    DOMAIN_VALIDATION_USER,
)

logger = logging.getLogger(__name__)


def create_domain_validation_chain(
    model_name: str | None = None,
    temperature: float | None = None,
):
    """Create a chain that validates domain relevance of generated questions.

    Uses DeepSeek Flash (low-cost, fast) to check whether each question
    actually belongs to the user's target knowledge domain.

    Args:
        model_name: DeepSeek model name (defaults to settings.DEEPSEEK_FLASH_MODEL).
        temperature: Model temperature (defaults to settings.VALIDATION_TEMPERATURE).

    Returns:
        A LangChain Runnable that accepts a dict with keys:
        ``knowledge_domain``, ``knowledge_input``, ``questions_json``
        and returns a ``ValidationResult``.
    """
    model = ChatOpenAI(
        model=model_name or settings.DEEPSEEK_FLASH_MODEL,
        temperature=temperature if temperature is not None else settings.VALIDATION_TEMPERATURE,
        max_tokens=settings.VALIDATION_MAX_TOKENS,
        streaming=False,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_API_BASE,
    )

    parser = JsonOutputParser(pydantic_object=ValidationResult)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", DOMAIN_VALIDATION_SYSTEM),
            ("user", DOMAIN_VALIDATION_USER),
        ]
    )

    return prompt | model | parser


def build_domain_validation_input(
    knowledge_domain: str,
    knowledge_input: str,
    questions: list[dict],
) -> dict:
    """Build the input dict for the domain validation chain.

    Args:
        knowledge_domain: AI-identified knowledge domain (e.g. "Python 编程").
        knowledge_input: Raw user knowledge input.
        questions: List of generated question dicts.

    Returns:
        Dict ready for chain invocation.
    """
    parser = JsonOutputParser(pydantic_object=ValidationResult)

    return {
        "knowledge_domain": knowledge_domain,
        "knowledge_input": knowledge_input,
        "questions_json": json.dumps(questions, ensure_ascii=False, indent=2),
        "format_instructions": parser.get_format_instructions(),
    }


async def validate_domain(
    knowledge_domain: str,
    knowledge_input: str,
    questions: list[dict],
) -> ValidationResult:
    """Validate domain relevance of generated questions.

    On any error (API failure, parse error, timeout), returns a degraded
    ``ValidationResult(valid=False, issues=[...])`` without blocking the flow.

    Args:
        knowledge_domain: AI-identified knowledge domain.
        knowledge_input: Raw user knowledge input.
        questions: List of generated question dicts.

    Returns:
        ``ValidationResult`` — on error, ``valid=False`` with a single
        ``ValidationIssue`` describing the failure (not blocking).
    """
    try:
        chain = create_domain_validation_chain()
        chain_input = build_domain_validation_input(
            knowledge_domain, knowledge_input, questions
        )
        raw_result = await chain.ainvoke(chain_input)

        # JsonOutputParser may return dict or Pydantic model depending on version
        if isinstance(raw_result, dict):
            result = ValidationResult(**raw_result)
        else:
            result = raw_result

        logger.info(
            "Domain validation: valid=%s, issues=%d",
            result.valid,
            len(result.issues),
        )
        return result

    except Exception as exc:
        # Degradation: return a non-blocking ValidationResult
        logger.warning("Domain validation failed (degraded): %s", exc)
        from app.models.quiz import ValidationIssue

        return ValidationResult(
            valid=False,
            issues=[
                ValidationIssue(
                    question_id="*",
                    problem="校验服务异常",
                    suggestion=f"校验服务暂时不可用，请人工检查题目领域相关性",
                )
            ],
        )
