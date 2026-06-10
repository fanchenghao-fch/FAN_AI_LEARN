"""User API routes — profile, stats, history, wrong questions, check-in."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.user_orm import (
    CheckIn,
    LevelConfig,
    QuizSessionRecord,
    User,
    WrongQuestion,
)
from app.models.user_schemas import (
    HistoryItem,
    HistoryPage,
    RetryAnswerRequest,
    UserStats,
    WrongQuestionDetailResponse,
    WrongQuestionItem,
    WrongQuestionsByDomain,
    WrongQuestionsResponse,
)
from app.services.auth import get_current_user
from app.services.points import (
    get_level_for_exp,
    get_next_level_info,
    get_or_create_checkin,
    get_user_streak_days,
)

router = APIRouter(prefix="/api/user", tags=["user"])


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

async def _get_level_title(db: AsyncSession, level_id: int) -> str:
    """Resolve a level_id to its title string."""
    result = await db.execute(
        select(LevelConfig.title).where(LevelConfig.level == level_id)
    )
    row = result.scalar_one_or_none()
    return row if row else "初学萌新"


def _parse_options(options_raw: str | None) -> list[dict] | None:
    """Parse JSON-serialised answer options, returning None on failure."""
    if options_raw is None:
        return None
    try:
        parsed = json.loads(options_raw)
        return parsed if isinstance(parsed, list) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _wrong_q_to_item(wq: WrongQuestion) -> WrongQuestionItem:
    """Convert WrongQuestion ORM to WrongQuestionItem schema."""
    return WrongQuestionItem(
        id=wq.id,
        question_id=wq.question_id,
        content=wq.content,
        user_answer=wq.user_answer,
        correct_answer=wq.correct_answer,
        explanation=wq.explanation,
        domain=wq.domain,
        resolved=bool(wq.resolved),
        created_at=wq.created_at,
        options=_parse_options(wq.options),
    )


# ═══════════════════════════════════════════════════════════════
# GET /api/user/stats
# ═══════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_user_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's learning statistics."""
    # Total sessions & average accuracy
    result = await db.execute(
        select(
            func.count(QuizSessionRecord.id).label("total"),
            func.coalesce(func.avg(QuizSessionRecord.accuracy), 0.0).label("avg_acc"),
        ).where(QuizSessionRecord.user_id == user.id)
    )
    row = result.one()
    total_sessions = row.total
    avg_accuracy = round(float(row.avg_acc), 2)

    # Streak days
    streak_days = await get_user_streak_days(user.id, db)

    # Level info
    level_id = user.level_id
    level_title = await _get_level_title(db, level_id)
    current_level, exp_to_next, exp_percent = get_next_level_info(user.experience)

    return {
        "code": 0,
        "message": "ok",
        "data": UserStats(
            total_sessions=total_sessions,
            accuracy=avg_accuracy,
            streak_days=streak_days,
            coins=user.coins,
            experience=user.experience,
            level=level_id,
            level_title=level_title,
            exp_to_next=exp_to_next,
            exp_percent=exp_percent,
        ).model_dump(),
    }


# ═══════════════════════════════════════════════════════════════
# GET /api/user/history
# ═══════════════════════════════════════════════════════════════

@router.get("/history")
async def get_user_history(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=50, description="Items per page"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated quiz session history for current user."""
    # Count total
    count_result = await db.execute(
        select(func.count(QuizSessionRecord.id)).where(
            QuizSessionRecord.user_id == user.id
        )
    )
    total = count_result.scalar()

    # Fetch page
    offset = (page - 1) * page_size
    result = await db.execute(
        select(QuizSessionRecord)
        .where(QuizSessionRecord.user_id == user.id)
        .order_by(QuizSessionRecord.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    sessions = result.scalars().all()

    items = [
        HistoryItem(
            session_id=s.id,
            quiz_id=s.quiz_id,
            title=s.title,
            domain=s.domain,
            score=s.score,
            total=s.total,
            accuracy=s.accuracy,
            time_spent=s.time_spent,
            created_at=s.created_at,
        )
        for s in sessions
    ]

    has_more = (offset + page_size) < total

    return {
        "code": 0,
        "message": "ok",
        "data": HistoryPage(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        ).model_dump(),
    }


# ═══════════════════════════════════════════════════════════════
# GET /api/user/wrong-questions
# ═══════════════════════════════════════════════════════════════

@router.get("/wrong-questions")
async def get_wrong_questions(
    resolved: int | None = Query(None, ge=0, le=1, description="Filter: 0=待复习, 1=已掌握, null=全部"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get wrong questions grouped by domain."""
    # Build query
    conditions = [WrongQuestion.user_id == user.id]
    if resolved is not None:
        conditions.append(WrongQuestion.resolved == resolved)

    result = await db.execute(
        select(WrongQuestion)
        .where(*conditions)
        .order_by(WrongQuestion.created_at.desc())
    )
    wrong_qs = result.scalars().all()

    # Group by domain
    grouped: dict[str, list[WrongQuestionItem]] = {}
    for wq in wrong_qs:
        domain = wq.domain or "其他"
        if domain not in grouped:
            grouped[domain] = []
        grouped[domain].append(_wrong_q_to_item(wq))

    groups = [
        WrongQuestionsByDomain(
            domain=domain,
            count=len(items),
            questions=items,
        )
        for domain, items in grouped.items()
    ]

    # Count resolved/unresolved (separate queries for accurate totals)
    resolved_count = sum(1 for wq in wrong_qs if wq.resolved)
    unresolved_count = sum(1 for wq in wrong_qs if not wq.resolved)

    return {
        "code": 0,
        "message": "ok",
        "data": WrongQuestionsResponse(
            groups=groups,
            total=len(wrong_qs),
            resolved_count=resolved_count,
            unresolved_count=unresolved_count,
        ).model_dump(),
    }


# ═══════════════════════════════════════════════════════════════
# GET /api/user/wrong-questions/{id}
# ═══════════════════════════════════════════════════════════════

@router.get("/wrong-questions/{wrong_id}")
async def get_wrong_question_detail(
    wrong_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed view of a single wrong question."""
    result = await db.execute(
        select(WrongQuestion)
        .where(
            WrongQuestion.id == wrong_id,
            WrongQuestion.user_id == user.id,
        )
    )
    wq = result.scalar_one_or_none()

    if wq is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="错题不存在",
        )

    # Get session title
    session_title = ""
    session_id = wq.session_id
    if session_id:
        sess_result = await db.execute(
            select(QuizSessionRecord.title).where(
                QuizSessionRecord.id == session_id
            )
        )
        row = sess_result.scalar_one_or_none()
        if row:
            session_title = row

    return {
        "code": 0,
        "message": "ok",
        "data": WrongQuestionDetailResponse(
            id=wq.id,
            question_id=wq.question_id,
            content=wq.content,
            user_answer=wq.user_answer,
            correct_answer=wq.correct_answer,
            explanation=wq.explanation,
            domain=wq.domain,
            resolved=bool(wq.resolved),
            created_at=wq.created_at,
            resolved_at=wq.resolved_at,
            session_title=session_title,
            session_id=session_id,
            options=_parse_options(wq.options),
        ).model_dump(),
    }


# ═══════════════════════════════════════════════════════════════
# POST /api/user/wrong-questions/{id}/resolve
# ═══════════════════════════════════════════════════════════════

@router.post("/wrong-questions/{wrong_id}/resolve")
async def resolve_wrong_question(
    wrong_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a wrong question as resolved (已掌握)."""
    result = await db.execute(
        select(WrongQuestion)
        .where(
            WrongQuestion.id == wrong_id,
            WrongQuestion.user_id == user.id,
        )
    )
    wq = result.scalar_one_or_none()

    if wq is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="错题不存在",
        )

    if wq.resolved:
        return {
            "code": 0,
            "message": "该错题已经是已掌握状态",
            "data": {"resolved": True, "resolved_at": wq.resolved_at.isoformat() if wq.resolved_at else None},
        }

    wq.resolved = 1
    wq.resolved_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "code": 0,
        "message": "已标记为已掌握",
        "data": {
            "resolved": True,
            "resolved_at": wq.resolved_at.isoformat() if wq.resolved_at else None,
        },
    }


# ═══════════════════════════════════════════════════════════════
# POST /api/user/wrong-questions/{id}/retry
# ═══════════════════════════════════════════════════════════════

@router.post("/wrong-questions/{wrong_id}/retry")
async def retry_wrong_question(
    wrong_id: str,
    body: RetryAnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-answer a wrong question.

    If the answer is correct the wrong question is auto-resolved and a
    small coin reward (+2) is granted.  Incorrect answers keep the
    question in "待复习" state.
    """
    result = await db.execute(
        select(WrongQuestion)
        .where(
            WrongQuestion.id == wrong_id,
            WrongQuestion.user_id == user.id,
        )
    )
    wq = result.scalar_one_or_none()

    if wq is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="错题不存在",
        )

    # Normalise for comparison
    is_correct = body.user_answer.strip().upper() == wq.correct_answer.strip().upper()

    coins_earned = 0

    if is_correct:
        # Auto-resolve if not already resolved
        if not wq.resolved:
            wq.resolved = 1
            wq.resolved_at = datetime.now(timezone.utc)
            # Small reward for re-answering correctly
            coins_earned = 2
            user.coins += coins_earned
            user.experience += coins_earned

            # Check level-up
            from app.services.points import update_user_level
            new_level = update_user_level(user.experience, user.level_id)
            if new_level != user.level_id:
                user.level_id = new_level

            await db.flush()

    return {
        "code": 0,
        "message": "回答正确！" if is_correct else "继续加油！",
        "data": {
            "is_correct": is_correct,
            "correct_answer": wq.correct_answer,
            "resolved": bool(wq.resolved),
            "coins_earned": coins_earned,
        },
    }


# ═══════════════════════════════════════════════════════════════
# POST /api/user/checkin
# ═══════════════════════════════════════════════════════════════

@router.post("/checkin")
async def user_checkin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manual daily check-in. Returns streak info."""
    checkin = await get_or_create_checkin(user.id, db)

    streak_days = await get_user_streak_days(user.id, db)

    if checkin is None:
        return {
            "code": 0,
            "message": "今日已签到",
            "data": {
                "checked_in": False,
                "streak_days": streak_days,
            },
        }

    return {
        "code": 0,
        "message": "签到成功",
        "data": {
            "checked_in": True,
            "streak_days": streak_days,
        },
    }
