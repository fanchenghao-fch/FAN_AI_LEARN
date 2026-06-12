"""Pydantic schemas for auth and user API request/response models.

Distinct from ORM models — these define the wire format.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ═══════════════════════════════════════════════════════════════
# Auth — Request
# ═══════════════════════════════════════════════════════════════

class WechatLoginRequest(BaseModel):
    """微信小程序登录请求."""
    code: str = Field(..., min_length=1, description="wx.login 返回的 code")
    nickname: Optional[str] = Field(None, max_length=64, description="用户昵称（可选）")
    avatar_url: Optional[str] = Field(None, max_length=512, description="头像URL（可选）")


# ═══════════════════════════════════════════════════════════════
# Auth — Response
# ═══════════════════════════════════════════════════════════════

class UserBrief(BaseModel):
    """用户简要信息（用于登录响应）."""
    id: str
    nickname: str
    avatar_url: Optional[str] = None
    coins: int
    experience: int
    level: int
    level_title: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    """登录成功响应."""
    token: str
    user: UserBrief


class UserProfileResponse(BaseModel):
    """GET /api/auth/me 响应."""
    user: UserBrief


# ═══════════════════════════════════════════════════════════════
# User Stats
# ═══════════════════════════════════════════════════════════════

class UserStats(BaseModel):
    """用户统计数据."""
    total_sessions: int = 0       # 累计闯关
    accuracy: float = 0.0         # 平均正确率 (0-1)
    streak_days: int = 0          # 连续打卡天数
    coins: int = 0                # 金币余额
    experience: int = 0           # 经验值
    level: int = 1                # 等级
    level_title: str = "初学萌新"  # 等级称号
    exp_to_next: int = 100        # 距下一级所需经验
    exp_percent: float = 0.0      # 当前等级经验进度百分比


class HistoryItem(BaseModel):
    """学习历史列表项."""
    session_id: str
    quiz_id: str
    title: str
    domain: str
    score: int
    total: int
    accuracy: float
    time_spent: int
    created_at: datetime


class HistoryPage(BaseModel):
    """分页历史记录."""
    items: list[HistoryItem]
    total: int
    page: int
    page_size: int
    has_more: bool


# ═══════════════════════════════════════════════════════════════
# Wrong Questions
# ═══════════════════════════════════════════════════════════════

class WrongQuestionItem(BaseModel):
    """错题列表项."""
    id: str
    question_id: str
    content: str
    user_answer: str
    correct_answer: str
    explanation: str
    domain: str
    resolved: bool
    created_at: datetime
    options: list[dict] | None = None  # JSON-deserialised answer options

    model_config = ConfigDict(from_attributes=True)


class WrongQuestionsByDomain(BaseModel):
    """按领域分组的错题."""
    domain: str
    count: int
    questions: list[WrongQuestionItem]


class WrongQuestionDetailResponse(BaseModel):
    """错题详情（含 session 上下文）."""
    id: str
    question_id: str
    content: str
    user_answer: str
    correct_answer: str
    explanation: str
    domain: str
    resolved: bool
    created_at: datetime
    resolved_at: datetime | None = None
    session_title: str = ""
    session_id: str = ""
    options: list[dict] | None = None  # JSON-deserialised answer options


class RetryAnswerRequest(BaseModel):
    """错题重做请求."""
    user_answer: str = Field(..., min_length=1, description="用户重新选择的答案")


class RetryAnswerResponse(BaseModel):
    """错题重做响应."""
    is_correct: bool
    correct_answer: str
    resolved: bool  # True if answer was correct → auto-resolved
    coins_earned: int = 0  # Small reward for re-answering correctly


class WrongQuestionsResponse(BaseModel):
    """错题列表响应."""
    groups: list[WrongQuestionsByDomain]
    total: int
    resolved_count: int = 0
    unresolved_count: int = 0


# ═══════════════════════════════════════════════════════════════
# Session Detail (for history drill-down)
# ═══════════════════════════════════════════════════════════════

class SessionWrongQuestion(BaseModel):
    """简化的错题信息（会话详情中用）."""
    id: str
    question_id: str
    content: str
    user_answer: str
    correct_answer: str
    explanation: str
    resolved: bool
    created_at: datetime


class SessionDetailResponse(BaseModel):
    """单次闯关会话详情."""
    session_id: str
    quiz_id: str
    title: str
    domain: str
    score: int
    total: int
    accuracy: float
    time_spent: int
    combo_max: int
    coins_earned: int
    created_at: datetime
    wrong_questions: list[SessionWrongQuestion] = []


# ═══════════════════════════════════════════════════════════════
# Quiz Result with Reward (extended for analyze endpoint)
# ═══════════════════════════════════════════════════════════════

class RewardInfo(BaseModel):
    """答题奖励信息."""
    coins_earned: int = 0
    experience_earned: int = 0
    new_level: int | None = None
    new_level_title: str | None = None
    is_first_today: bool = False
