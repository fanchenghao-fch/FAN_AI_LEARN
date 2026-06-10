"""Quiz API routes — generation and analysis (WeChat Mini Program)."""

import uuid

from fastapi import APIRouter

from app.models.api import QuizGenerateRequest, QuizAnalyzeRequest, APIResponse
from app.models.quiz import QuizOutput, QuizResult
from app.chains.quiz_generation import (
    create_quiz_generation_chain,
    build_generation_input,
)
from app.chains.quiz_validation import (
    create_validation_chain,
    build_validation_input,
)
from app.chains.result_analysis import (
    create_analysis_chain,
    build_analysis_input,
)

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


@router.post("/generate-sync")
async def generate_quiz_sync(request: QuizGenerateRequest):
    """Generate quiz questions — synchronous JSON response.

    Used by WeChat Mini Program (which cannot consume SSE streams via
    wx.request).  Runs the same generation + validation chains as the
    SSE endpoint but returns a single JSON payload.

    Returns:
        JSON object with quiz_id, title, knowledge_domain, questions,
        and validation.  On error returns APIResponse with code=500.
    """
    try:
        # Stage 1: Generate questions (non-streaming)
        gen_chain = create_quiz_generation_chain(streaming=False)
        gen_input = build_generation_input(
            knowledge_input=request.knowledge_input,
            question_count=request.question_count,
            question_types=request.question_types,
            difficulty=request.difficulty,
        )

        full_output = await gen_chain.ainvoke(gen_input)
        quiz_output = QuizOutput(**full_output)

        # Stage 2: Validate questions
        questions_dict = [q.model_dump() for q in quiz_output.questions]
        val_chain = create_validation_chain()
        val_input = build_validation_input(questions_dict)
        validation_result = await val_chain.ainvoke(val_input)

        # Stage 3: Return result
        quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"

        return APIResponse(
            code=0,
            message="ok",
            data={
                "quiz_id": quiz_id,
                "title": quiz_output.title,
                "knowledge_domain": quiz_output.knowledge_domain,
                "questions": [q.model_dump() for q in quiz_output.questions],
                "validation": validation_result,
            },
        )

    except Exception as e:
        return APIResponse(
            code=500,
            message=f"题目生成失败: {str(e)}",
        )


@router.post("/analyze")
async def analyze_quiz(request: QuizAnalyzeRequest):
    """Analyze quiz results and generate learning report.

    Args:
        request: Quiz data with user answers.

    Returns:
        APIResponse with QuizResult data.
    """
    try:
        # Extract quiz metadata
        total_questions = len(request.questions)
        score = sum(1 for a in request.answers if a.get("is_correct", False))
        knowledge_domain = "未知领域"

        # Build quiz data for analysis
        quiz_data = []
        for answer in request.answers:
            question = next(
                (q for q in request.questions if q.get("id") == answer.get("question_id")),
                None,
            )
            if question:
                quiz_data.append({
                    "question_id": answer["question_id"],
                    "content": question.get("content", ""),
                    "user_answer": answer.get("user_answer", ""),
                    "correct_answer": question.get("correct_answer", ""),
                    "is_correct": answer.get("is_correct", False),
                    "time_spent": answer.get("time_spent", 0),
                    "explanation": question.get("explanation", ""),
                    "difficulty": question.get("difficulty", "medium"),
                })

        # Run analysis chain
        analysis_chain = create_analysis_chain()
        analysis_input = build_analysis_input(
            quiz_data=quiz_data,
            score=score,
            total_questions=total_questions,
            total_time=request.total_time,
            knowledge_domain=knowledge_domain,
        )
        analysis_output = await analysis_chain.ainvoke(analysis_input)

        # Build wrong questions list
        wrong_questions = [
            {
                "question_id": a["question_id"],
                "content": a["content"],
                "user_answer": a["user_answer"],
                "correct_answer": a["correct_answer"],
                "explanation": a["explanation"],
            }
            for a in quiz_data
            if not a["is_correct"]
        ]

        result = QuizResult(
            quiz_id=request.quiz_id,
            title="闯关结果",
            score=score,
            total_questions=total_questions,
            accuracy=round(score / total_questions, 2) if total_questions > 0 else 0.0,
            total_time=request.total_time,
            knowledge_summary=analysis_output.get("knowledge_summary", []),
            wrong_questions=wrong_questions,
            mastery_radar=analysis_output.get("mastery_radar", {}).get("dimensions", {}),
            study_suggestion=analysis_output.get("study_suggestion", ""),
        )

        return APIResponse(
            code=0,
            message="ok",
            data=result.model_dump(),
        )

    except Exception as e:
        return APIResponse(
            code=500,
            message=f"分析失败: {str(e)}",
        )
