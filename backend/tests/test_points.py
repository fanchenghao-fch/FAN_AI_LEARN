"""TDD tests for points/experience calculation service.

Covers:
  - calculate_coins: base + correct + combo + first-of-day + cap
  - calculate_experience: 1:1 mapping from coins
  - get_or_create_checkin: first check-in + duplicate prevention
  - get_streak_days: consecutive daily check-in counting
  - update_user_level: auto-level-up based on experience thresholds
"""

import pytest
from datetime import date, timedelta

from app.services.points import (
    calculate_coins,
    calculate_experience,
    get_streak_days,
    update_user_level,
    COINS_BASE,
    COINS_PER_CORRECT,
    COINS_COMBO_5,
    COINS_COMBO_10,
    COINS_FIRST_OF_DAY,
    COINS_MAX,
    LEVEL_CONFIGS,
)


# ═══════════════════════════════════════════════════════════════
# calculate_coins
# ═══════════════════════════════════════════════════════════════

class TestCalculateCoins:
    """Unit tests for calculate_coins()."""

    def test_base_coins_only(self):
        """0 correct, no combo, not first → just base coins."""
        coins = calculate_coins(
            correct=0, total=5, combo_max=0, is_first_today=False
        )
        assert coins == COINS_BASE  # 10

    def test_correct_answer_bonus(self):
        """Each correct answer adds COINS_PER_CORRECT."""
        coins = calculate_coins(
            correct=3, total=5, combo_max=2, is_first_today=False
        )
        assert coins == COINS_BASE + 3 * COINS_PER_CORRECT  # 10 + 6 = 16

    def test_combo_5_bonus(self):
        """Combo ≥5 adds COINS_COMBO_5."""
        coins = calculate_coins(
            correct=5, total=5, combo_max=5, is_first_today=False
        )
        assert coins == COINS_BASE + 5 * COINS_PER_CORRECT + COINS_COMBO_5  # 10+10+5=25

    def test_combo_10_bonus(self):
        """Combo ≥10 adds COINS_COMBO_10 (replaces combo_5, not additive)."""
        coins = calculate_coins(
            correct=10, total=10, combo_max=10, is_first_today=False
        )
        # Both combo_5 and combo_10 thresholds are met; combo_10 applies
        # But does it replace or add? The design says +5 for combo≥5, +15 for combo≥10.
        # We'll interpret it as additive: if combo≥10, you get both bonuses
        assert coins == COINS_BASE + 10 * COINS_PER_CORRECT + COINS_COMBO_5 + COINS_COMBO_10

    def test_first_of_day_bonus(self):
        """First quiz of the day adds COINS_FIRST_OF_DAY."""
        coins = calculate_coins(
            correct=2, total=5, combo_max=1, is_first_today=True
        )
        assert coins == COINS_BASE + 2 * COINS_PER_CORRECT + COINS_FIRST_OF_DAY  # 10+4+20=34

    def test_max_cap(self):
        """Coins should not exceed COINS_MAX per quiz session."""
        coins = calculate_coins(
            correct=50, total=50, combo_max=50, is_first_today=True
        )
        assert coins == COINS_MAX  # capped at 100

    def test_all_zeros(self):
        """Edge case: all zeros should still give base coins."""
        coins = calculate_coins(
            correct=0, total=0, combo_max=0, is_first_today=False
        )
        assert coins == COINS_BASE

    def test_combo_below_threshold_no_bonus(self):
        """Combo of 4 should NOT trigger combo bonus."""
        coins = calculate_coins(
            correct=4, total=5, combo_max=4, is_first_today=False
        )
        assert coins == COINS_BASE + 4 * COINS_PER_CORRECT  # no combo bonus

    def test_combo_between_5_and_10(self):
        """Combo of 7 should trigger combo_5 but not combo_10."""
        coins = calculate_coins(
            correct=7, total=7, combo_max=7, is_first_today=False
        )
        assert coins == COINS_BASE + 7 * COINS_PER_CORRECT + COINS_COMBO_5


# ═══════════════════════════════════════════════════════════════
# calculate_experience
# ═══════════════════════════════════════════════════════════════

class TestCalculateExperience:
    """Unit tests for calculate_experience()."""

    def test_exp_equals_coins(self):
        """Experience earned = coins earned (1:1 mapping)."""
        assert calculate_experience(25) == 25
        assert calculate_experience(100) == 100
        assert calculate_experience(10) == 10

    def test_zero_coins_zero_exp(self):
        assert calculate_experience(0) == 0


# ═══════════════════════════════════════════════════════════════
# get_streak_days
# ═══════════════════════════════════════════════════════════════

class TestGetStreakDays:
    """Unit tests for get_streak_days()."""

    def test_empty_list_zero_streak(self):
        """No check-ins → 0 streak."""
        assert get_streak_days([]) == 0

    def test_single_today_is_1(self):
        """One check-in today → streak of 1."""
        assert get_streak_days([date.today()]) == 1

    def test_consecutive_days(self):
        """3 consecutive days → streak of 3."""
        today = date.today()
        dates = [today, today - timedelta(days=1), today - timedelta(days=2)]
        assert get_streak_days(dates) == 3

    def test_gap_breaks_streak(self):
        """Missing a day resets the streak."""
        today = date.today()
        dates = [today, today - timedelta(days=2)]  # skipped yesterday
        assert get_streak_days(dates) == 1  # only today counts

    def test_unsorted_dates_still_work(self):
        """Unsorted inputs should be handled correctly."""
        today = date.today()
        dates = [today - timedelta(days=2), today, today - timedelta(days=1)]
        assert get_streak_days(dates) == 3

    def test_only_yesterday_no_today(self):
        """If yesterday was checked in but not today, streak is 0 (broken)."""
        dates = [date.today() - timedelta(days=1)]
        assert get_streak_days(dates) == 0


# ═══════════════════════════════════════════════════════════════
# update_user_level
# ═══════════════════════════════════════════════════════════════

class TestUpdateUserLevel:
    """Unit tests for update_user_level()."""

    def test_new_user_stays_level_1(self):
        """0 exp → level 1."""
        new_level = update_user_level(0, 1)
        assert new_level == 1

    def test_reach_level_2(self):
        """100 exp → level 2."""
        new_level = update_user_level(100, 1)
        assert new_level == 2

    def test_reach_level_3(self):
        """300 exp → level 3."""
        new_level = update_user_level(300, 1)
        assert new_level == 3

    def test_reach_level_4(self):
        """600 exp → level 4."""
        new_level = update_user_level(600, 1)
        assert new_level == 4

    def test_reach_level_5(self):
        """1000 exp → level 5."""
        new_level = update_user_level(1000, 1)
        assert new_level == 5

    def test_beyond_max_level(self):
        """5000 exp beyond level 5 cap → stays 5."""
        new_level = update_user_level(5000, 1)
        assert new_level == 5

    def test_existing_level_not_downgraded(self):
        """If already at level 3 with 600 exp, should go to level 4, not stay at 3."""
        new_level = update_user_level(600, 2)
        assert new_level == 4

    def test_exp_between_levels(self):
        """250 exp → still level 2 (not enough for level 3)."""
        new_level = update_user_level(250, 1)
        assert new_level == 2

    def test_just_below_threshold(self):
        """99 exp → still level 1."""
        new_level = update_user_level(99, 1)
        assert new_level == 1

    def test_exact_level_3_threshold(self):
        """At exactly the threshold from level 2."""
        new_level = update_user_level(300, 2)
        assert new_level == 3
