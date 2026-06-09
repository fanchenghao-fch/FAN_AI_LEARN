"""Result analysis chain using DeepSeek Pro.

Generates personalized learning reports from quiz answer data,
including knowledge summaries, wrong-question analysis,
mastery radar charts, and study recommendations.
"""

import json

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.config import settings
from app.models.quiz import AnalysisOutput
from app.prompts.result_analysis import ANALYSIS_SYSTEM, ANALYSIS_USER


def create_analysis_chain(
    model_name: str | None = None,
    temperature: float | None = None,
):
    """Create a LangChain LCEL chain for quiz result analysis.

    Args:
        model_name: DeepSeek model name (defaults to settings.DEEPSEEK_PRO_MODEL).
        temperature: Model temperature (defaults to settings.ANALYSIS_TEMPERATURE).

    Returns:
        A LangChain Runnable chain that accepts a dict with keys:
        - total_questions (int)
        - score (int)
        - accuracy (float)
        - total_time (int)
        - knowledge_domain (str)
        - quiz_data (str)
        - format_instructions (str)
        And returns a parsed AnalysisOutput.
    """
    model = ChatOpenAI(
        model=model_name or settings.DEEPSEEK_PRO_MODEL,
        temperature=temperature if temperature is not None else settings.ANALYSIS_TEMPERATURE,
        max_tokens=settings.ANALYSIS_MAX_TOKENS,
        streaming=False,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_API_BASE,
    )

    parser = JsonOutputParser(pydantic_object=AnalysisOutput)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", ANALYSIS_SYSTEM),
            ("user", ANALYSIS_USER),
        ]
    )

    chain = prompt | model | parser

    return chain


def build_analysis_input(
    quiz_data: list[dict],
    score: int,
    total_questions: int,
    total_time: int,
    knowledge_domain: str,
) -> dict:
    """Build the input dict for the analysis chain.

    Args:
        quiz_data: List of dicts with question, user_answer, and is_correct info.
        score: Number of correct answers.
        total_questions: Total number of questions.
        total_time: Total quiz duration in seconds.
        knowledge_domain: The knowledge domain being tested.

    Returns:
        Dict ready for chain invocation.
    """
    parser = JsonOutputParser(pydantic_object=AnalysisOutput)
    accuracy = round(score / total_questions, 2) if total_questions > 0 else 0.0

    return {
        "total_questions": total_questions,
        "score": score,
        "accuracy": accuracy,
        "total_time": total_time,
        "knowledge_domain": knowledge_domain,
        "quiz_data": json.dumps(quiz_data, ensure_ascii=False, indent=2),
        "format_instructions": parser.get_format_instructions(),
    }
