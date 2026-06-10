"""Authentication service: JWT generation/verification and WeChat login.

JWT payload:
  {"sub": "<user_id>", "exp": <unix_timestamp>, "iat": <unix_timestamp>}
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user_orm import User
from app.models.user_schemas import UserBrief

# ── JWT ──────────────────────────────────────────────────────


def create_jwt(user_id: str) -> str:
    """Create a JWT token for the given user ID."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Decode and verify a JWT token. Raises jwt.PyJWTError on failure."""
    return jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )


# ── FastAPI Auth Dependency ──────────────────────────────────

bearer_scheme = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Dependency: resolves the current user from Bearer token, or returns None.

    Use this for endpoints that work for both anonymous and authenticated users
    (e.g. quiz analyze — saves records only when logged in).
    """
    if credentials is None:
        return None

    try:
        payload = decode_jwt(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
    except jwt.PyJWTError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency: resolves and requires the current user.

    Raises 401 if the token is missing, invalid, or expired.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_jwt(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的登录凭证",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已过期，请重新登录",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的登录凭证",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    return user


# ── User Helpers ─────────────────────────────────────────────


async def get_or_create_wechat_user(
    db: AsyncSession,
    open_id: str,
    nickname: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """Find a user by WeChat open_id or create a new one."""
    result = await db.execute(
        select(User).where(User.open_id == open_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            open_id=open_id,
            nickname=nickname or "灯灯学员",
            avatar_url=avatar_url,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)  # Load server-generated defaults (created_at, etc.)

    return user


# ── WeChat Code → OpenID ─────────────────────────────────────

async def wechat_code_to_openid(code: str) -> tuple[str, str | None]:
    """Exchange wx.login code for openid (and optional unionid).

    Returns (openid, unionid).

    Raises HTTPException(503) if WeChat credentials are not configured.
    Raises HTTPException(400) if the code is invalid.
    """
    if not settings.WECHAT_APP_ID or not settings.WECHAT_APP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="微信登录暂未配置（缺少 WECHAT_APP_ID / WECHAT_APP_SECRET）",
        )

    import httpx

    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": settings.WECHAT_APP_ID,
        "secret": settings.WECHAT_APP_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        data = resp.json()

    if "errcode" in data and data["errcode"] != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"微信登录失败: {data.get('errmsg', '未知错误')}",
        )

    return data.get("openid", ""), data.get("unionid")


# ── User → UserBrief ─────────────────────────────────────────


async def user_to_brief(user: User, db: AsyncSession) -> UserBrief:
    """Convert a User ORM object to a UserBrief response, resolving level title."""
    from app.models.user_orm import LevelConfig

    level_title = "初学萌新"
    result = await db.execute(
        select(LevelConfig.title).where(LevelConfig.level == user.level_id)
    )
    row = result.scalar_one_or_none()
    if row:
        level_title = row

    return UserBrief(
        id=user.id,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        coins=user.coins,
        experience=user.experience,
        level=user.level_id,
        level_title=level_title,
        created_at=user.created_at,
    )
