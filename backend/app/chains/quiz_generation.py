"""Quiz generation chain using DeepSeek Pro via LangChain.

This is the core chain that transforms user knowledge input into
structured quiz questions (choice + true/false) with validated answers.
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.config import settings
from app.models.quiz import QuizOutput
from app.prompts.quiz_generation import QUIZ_GENERATION_SYSTEM, QUIZ_GENERATION_USER


def create_quiz_generation_chain(
    model_name: str | None = None,
    temperature: float | None = None,
    streaming: bool = True,
):
    """Create a LangChain LCEL chain for quiz generation.

    Args:
        model_name: DeepSeek model name (defaults to settings.DEEPSEEK_PRO_MODEL).
        temperature: Model temperature (defaults to settings.GENERATION_TEMPERATURE).
        streaming: Whether to enable token-level streaming.

    Returns:
        A LangChain Runnable chain that accepts a dict with keys:
        - knowledge_input (str)
        - question_count (int, optional)
        - question_types (list[str], optional)
        - difficulty (str, optional)
        - format_instructions (str)
        And returns a parsed QuizOutput.
    """
    model = ChatOpenAI(
        model=model_name or settings.DEEPSEEK_PRO_MODEL,
        temperature=temperature if temperature is not None else settings.GENERATION_TEMPERATURE,
        max_tokens=settings.GENERATION_MAX_TOKENS,
        streaming=streaming,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_API_BASE,
    )

    parser = JsonOutputParser(pydantic_object=QuizOutput)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", QUIZ_GENERATION_SYSTEM),
            ("user", QUIZ_GENERATION_USER),
        ]
    )

    chain = prompt | model | parser

    return chain


def build_generation_input(
    knowledge_input: str,
    question_count: int = 10,
    question_types: list[str] | None = None,
    difficulty: str = "auto",
) -> dict:
    """Build the input dict for the quiz generation chain.

    Args:
        knowledge_input: The user's knowledge description.
        question_count: Number of questions (5-50).
        question_types: List of question types (default: ["选择题"]).
        difficulty: Target difficulty (easy|medium|hard|auto).

    Returns:
        Dict ready for chain invocation.
    """
    if question_types is None:
        question_types = ["选择题"]

    parser = JsonOutputParser(pydantic_object=QuizOutput)

    return {
        "knowledge_input": knowledge_input,
        "question_count": question_count,
        "question_types": "、".join(question_types),
        "difficulty": difficulty,
        "format_instructions": parser.get_format_instructions(),
    }
