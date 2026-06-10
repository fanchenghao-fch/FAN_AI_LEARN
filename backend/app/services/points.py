"""Points, experience, check-in, and level calculation service.

Coin rules (per quiz session):
  Base:       +10 coins   (每次闯关)
  Correct:    +2 coins    (每题正确)
  Combo ≥5:   +5 coins    (连击奖励)
  Combo ≥10:  +15 coins   (超级连击奖励，与 combo_5 叠加)
  First quiz: +20 coins   (每日首闯)
  Cap:        100 coins   (单次上限)

Experience: 1 exp = 1 coin earned.

Level thresholds (from level_configs seed data):
  Lv1 初学萌新:    0 exp
  Lv2 知识学徒:  100 exp
  Lv3 学习达人:  300 exp
  Lv4 百科高手:  600 exp
  Lv5 博学大师: 1000 exp
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_orm import CheckIn, LevelConfig, User

# ── Coin Constants ────────────────────────────────────────────

COINS_BASE = 10           # per quiz session
COINS_PER_CORRECT = 2     # per correct answer
COINS_COMBO_5 = 5         # combo ≥ 5
COINS_COMBO_10 = 15       # combo ≥ 10 (adds on top of combo_5)
COINS_FIRST_OF_DAY = 20   # first quiz of the day
COINS_MAX = 100           # max coins per session

# ── Level Thresholds ──────────────────────────────────────────

LEVEL_CONFIGS = [
    (1, "初学萌新", 0),
    (2, "知识学徒", 100),
    (3, "学习达人", 300),
    (4, "百科高手", 600),
    (5, "博学大师", 1000),
]

# Reverse-sorted for easy lookup: iterate from highest level down
_LEVELS_BY_EXP = sorted(LEVEL_CONFIGS, key=lambda x: x[2], reverse=True)


# ═══════════════════════════════════════════════════════════════
# Coin Calculation
# ═══════════════════════════════════════════════════════════════


def calculate_coins(
    correct: int,
    total: int,
    combo_max: int,
    is_first_today: bool,
) -> int:
    """Calculate coins earned for a single quiz session.

    Args:
        correct:        Number of correct answers.
        total:          Total number of questions.
        combo_max:      Max consecutive correct streak.
        is_first_today: Whether this is the user's first quiz today.

    Returns:
        Total coins earned (capped at COINS_MAX).
    """
    coins = COINS_BASE
    coins += correct * COINS_PER_CORRECT

    if combo_max >= 10:
        coins += COINS_COMBO_5 + COINS_COMBO_10
    elif combo_max >= 5:
        coins += COINS_COMBO_5

    if is_first_today:
        coins += COINS_FIRST_OF_DAY

    return min(coins, COINS_MAX)


# ═══════════════════════════════════════════════════════════════
# Experience Calculation
# ═══════════════════════════════════════════════════════════════


def calculate_experience(coins_earned: int) -> int:
    """Experience equals coins earned (1:1 mapping)."""
    return coins_earned


# ═══════════════════════════════════════════════════════════════
# Check-in
# ═══════════════════════════════════════════════════════════════


async def get_or_create_checkin(
    user_id: str,
    db: AsyncSession,
) -> CheckIn | None:
    """Create today's check-in if not already exists. Returns None if duplicate.

    Args:
        user_id: The user's ID.
        db:      Active database session.

    Returns:
        The new CheckIn row, or None if already checked in today.
    """
    today = date.today()

    # Check if already checked in today
    result = await db.execute(
        select(CheckIn).where(
            CheckIn.user_id == user_id,
            CheckIn.check_date == today,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        return None

    checkin = CheckIn(user_id=user_id, check_date=today)
    db.add(checkin)
    await db.flush()
    return checkin


async def get_today_checkin(
    user_id: str,
    db: AsyncSession,
) -> CheckIn | None:
    """Check if user already checked in today. Returns the CheckIn or None."""
    today = date.today()
    result = await db.execute(
        select(CheckIn).where(
            CheckIn.user_id == user_id,
            CheckIn.check_date == today,
        )
    )
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════
# Streak Days
# ═══════════════════════════════════════════════════════════════


def get_streak_days(dates: list[date]) -> int:
    """Count consecutive days ending at today (or most recent date).

    Args:
        dates: List of check-in dates (unsorted is fine).

    Returns:
        Number of consecutive days from today backward. 0 if today is missing.
    """
    if not dates:
        return 0

    # Sort descending (newest first) and deduplicate
    unique_dates = sorted(set(dates), reverse=True)

    today = date.today()

    # Streak must include today (or yesterday at earliest start)
    if unique_dates[0] != today:
        return 0

    streak = 1
    for i in range(len(unique_dates) - 1):
        expected_prev = unique_dates[i] - timedelta(days=1)
        if unique_dates[i + 1] == expected_prev:
            streak += 1
        else:
            break

    return streak


async def get_user_streak_days(
    user_id: str,
    db: AsyncSession,
) -> int:
    """Fetch all check-in dates for a user and compute streak days."""
    result = await db.execute(
        select(CheckIn.check_date)
        .where(CheckIn.user_id == user_id)
        .order_by(CheckIn.check_date.desc())
    )
    rows = result.all()
    dates = [row[0] for row in rows]
    return get_streak_days(dates)


# ═══════════════════════════════════════════════════════════════
# Level Calculation
# ═══════════════════════════════════════════════════════════════


def get_level_for_exp(experience: int) -> int:
    """Determine the highest level for a given experience total.

    Returns the level number (1-5).
    """
    for level, _title, min_exp in _LEVELS_BY_EXP:
        if experience >= min_exp:
            return level
    return 1  # fallback


def get_level_config(level: int) -> tuple[int, str, int]:
    """Get (level, title, min_exp) for a given level number."""
    for lv, title, min_exp in LEVEL_CONFIGS:
        if lv == level:
            return (lv, title, min_exp)
    return LEVEL_CONFIGS[0]  # fallback to level 1


def get_next_level_info(experience: int) -> tuple[int, int, float]:
    """Get exp_to_next and exp_percent for a given experience total.

    Returns:
        (current_level, exp_to_next, exp_percent)
        If at max level, exp_to_next = 0, exp_percent = 100.
    """
    current_level = get_level_for_exp(experience)

    if current_level >= 5:
        return (5, 0, 100.0)

    # Find the min_exp for current and next level
    current_min = 0
    next_min = 100
    for lv, _title, min_exp in LEVEL_CONFIGS:
        if lv == current_level:
            current_min = min_exp
        elif lv == current_level + 1:
            next_min = min_exp

    exp_in_level = experience - current_min
    exp_needed = next_min - current_min
    exp_percent = round((exp_in_level / exp_needed) * 100, 1) if exp_needed > 0 else 100.0

    return (current_level, next_min - experience, min(exp_percent, 100.0))


def update_user_level(
    experience: int,
    current_level_id: int = 1,
) -> int:
    """Determine the appropriate level for the given experience.

    Only upgrades — never downgrades.

    Args:
        experience:        Total user experience.
        current_level_id:  Current level ID (to prevent downgrades).

    Returns:
        The new level ID (1-5).
    """
    new_level = get_level_for_exp(experience)
    return max(current_level_id, new_level)
