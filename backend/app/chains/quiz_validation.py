"""Quiz validation chain using DeepSeek Flash for cost-effective verification.

Validates each question's correct answer against the source knowledge,
identifying errors before questions reach the user.
"""

import json

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.config import settings
from app.models.quiz import ValidationResult
from app.prompts.quiz_validation import VALIDATION_SYSTEM, VALIDATION_USER


def create_validation_chain(
    model_name: str | None = None,
    temperature: float | None = None,
):
    """Create a LangChain LCEL chain for question validation.

    Uses DeepSeek Flash (low-cost, fast) to verify each question's
    correctness before serving to users.

    Args:
        model_name: DeepSeek model name (defaults to settings.DEEPSEEK_FLASH_MODEL).
        temperature: Model temperature (defaults to settings.VALIDATION_TEMPERATURE).

    Returns:
        A LangChain Runnable chain that accepts a dict with key
        'questions_json' (JSON string of questions) and returns ValidationResult.
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
            ("system", VALIDATION_SYSTEM),
            ("user", VALIDATION_USER),
        ]
    )

    chain = prompt | model | parser

    return chain


def build_validation_input(questions: list[dict]) -> dict:
    """Build the input dict for the validation chain.

    Args:
        questions: List of question dicts to validate.

    Returns:
        Dict with 'questions_json' ready for chain invocation.
    """
    parser = JsonOutputParser(pydantic_object=ValidationResult)

    return {
        "questions_json": json.dumps(questions, ensure_ascii=False, indent=2),
        "format_instructions": parser.get_format_instructions(),
    }
