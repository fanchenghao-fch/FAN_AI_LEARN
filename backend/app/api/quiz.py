"""Quiz API routes — generation and analysis (WeChat Mini Program)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.api import QuizGenerateRequest, QuizAnalyzeRequest, APIResponse
from app.models.quiz import QuizOutput, QuizResult
from app.models.user_orm import (
    QuizSessionRecord,
    User,
    WrongQuestion,
)
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
from app.services.auth import get_optional_user
from app.services.points import (
    calculate_coins,
    calculate_experience,
    get_or_create_checkin,
    update_user_level,
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
async def analyze_quiz(
    request: QuizAnalyzeRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze quiz results and generate learning report.

    When the user is authenticated, also:
      - Creates a QuizSessionRecord
      - Creates WrongQuestion records for incorrect answers
      - Creates today's CheckIn
      - Awards coins and experience
      - Updates user level

    Anonymous users still get the full analysis result (just without saving).

    Args:
        request: Quiz data with user answers.
        user:    Optional authenticated user.
        db:      Database session.

    Returns:
        APIResponse with QuizResult data (and reward info if logged in).
    """
    try:
        # Extract quiz metadata
        total_questions = len(request.questions)
        correct_count = sum(1 for a in request.answers if a.get("is_correct", False))
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
            score=correct_count,
            total_questions=total_questions,
            total_time=request.total_time,
            knowledge_domain=knowledge_domain,
        )
        analysis_output = await analysis_chain.ainvoke(analysis_input)

        # Build wrong questions list (for response)
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

        # Detect combo_max from answers: max consecutive correct
        combo_max = 0
        current_combo = 0
        for a in request.answers:
            if a.get("is_correct", False):
                current_combo += 1
                combo_max = max(combo_max, current_combo)
            else:
                current_combo = 0

        # ── Save Records (authenticated users only) ──────────
        reward_data = {
            "coins_earned": 0,
            "experience_earned": 0,
            "new_level": None,
            "new_level_title": None,
            "is_first_today": False,
        }

        if user is not None:
            # 1. Check-in (today)
            checkin = await get_or_create_checkin(user.id, db)
            is_first_today = checkin is not None  # True if newly created

            # 2. Calculate coins & experience
            coins_earned = calculate_coins(
                correct=correct_count,
                total=total_questions,
                combo_max=combo_max,
                is_first_today=is_first_today,
            )
            experience_earned = calculate_experience(coins_earned)

            # 3. Create QuizSessionRecord
            accuracy = (
                round(correct_count / total_questions, 2)
                if total_questions > 0
                else 0.0
            )

            # Try to determine domain from the first question's content or use default
            domain = "综合"
            if request.questions:
                first_q = request.questions[0]
                # If quiz had a known domain, use it; otherwise "综合"
                domain = first_q.get("domain", "综合") if isinstance(first_q, dict) else "综合"

            session_record = QuizSessionRecord(
                user_id=user.id,
                quiz_id=request.quiz_id,
                domain=knowledge_domain,
                title="闯关结果",
                score=correct_count,
                total=total_questions,
                accuracy=accuracy,
                time_spent=request.total_time,
                coins_earned=coins_earned,
                combo_max=combo_max,
            )
            db.add(session_record)
            await db.flush()  # Get the session_record.id

            # 4. Create WrongQuestion records
            for a in quiz_data:
                if not a["is_correct"]:
                    wrong_q = WrongQuestion(
                        user_id=user.id,
                        session_id=session_record.id,
                        question_id=a["question_id"],
                        content=a["content"],
                        user_answer=a["user_answer"],
                        correct_answer=a["correct_answer"],
                        explanation=a["explanation"],
                        domain=knowledge_domain,
                        resolved=0,
                    )
                    db.add(wrong_q)

            # 5. Update user coins & experience
            old_level = user.level_id
            user.coins += coins_earned
            user.experience += experience_earned

            # 6. Check level up
            new_level = update_user_level(user.experience, user.level_id)
            if new_level != old_level:
                user.level_id = new_level

            await db.flush()

            # 7. Build reward info
            reward_data["coins_earned"] = coins_earned
            reward_data["experience_earned"] = experience_earned
            reward_data["is_first_today"] = is_first_today

            if new_level != old_level:
                from app.models.user_orm import LevelConfig
                from sqlalchemy import select as _sel
                lv_result = await db.execute(
                    _sel(LevelConfig.title).where(LevelConfig.level == new_level)
                )
                lv_title = lv_result.scalar_one_or_none()
                reward_data["new_level"] = new_level
                reward_data["new_level_title"] = lv_title or ""

        # ── Build Response ──────────────────────────────────
        result = QuizResult(
            quiz_id=request.quiz_id,
            title="闯关结果",
            score=correct_count,
            total_questions=total_questions,
            accuracy=round(correct_count / total_questions, 2) if total_questions > 0 else 0.0,
            total_time=request.total_time,
            knowledge_summary=analysis_output.get("knowledge_summary", []),
            wrong_questions=wrong_questions,
            mastery_radar=analysis_output.get("mastery_radar", {}).get("dimensions", {}),
            study_suggestion=analysis_output.get("study_suggestion", ""),
        )

        response_data = result.model_dump()
        response_data["reward"] = reward_data

        return APIResponse(
            code=0,
            message="ok",
            data=response_data,
        )

    except Exception as e:
        return APIResponse(
            code=500,
            message=f"分析失败: {str(e)}",
        )
