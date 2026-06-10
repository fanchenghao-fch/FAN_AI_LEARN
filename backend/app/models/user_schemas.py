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

class MockLoginRequest(BaseModel):
    """H5 Mock 登录请求."""
    nickname: str = Field(..., min_length=1, max_length=64, description="用户昵称")
    avatar_url: Optional[str] = Field(None, max_length=512, description="头像URL（可选）")


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
