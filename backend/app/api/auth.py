"""Auth API routes: WeChat login, mock login (dev/test), and current user."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user_schemas import (
    LoginResponse,
    UserProfileResponse,
    WechatLoginRequest,
)
from app.services.auth import (
    create_jwt,
    get_current_user,
    get_or_create_wechat_user,
    user_to_brief,
    wechat_code_to_openid,
)
from app.models.user_orm import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── WeChat Login ────────────────────────────────────────────

@router.post("/wechat-login", response_model=dict)
async def wechat_login(
    body: WechatLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """微信小程序登录：code → openid → 创建/匹配用户 → 返回 JWT。"""
    open_id, union_id = await wechat_code_to_openid(body.code)

    user = await get_or_create_wechat_user(
        db,
        open_id=open_id,
        nickname=body.nickname,
        avatar_url=body.avatar_url,
    )

    # Update union_id if newly available
    if union_id and user.union_id is None:
        user.union_id = union_id

    token = create_jwt(user.id)
    user_brief = await user_to_brief(user, db)

    return {
        "code": 0,
        "message": "ok",
        "data": LoginResponse(token=token, user=user_brief).model_dump(),
    }


# ── Mock Login (dev/test only) ────────────────────────────────

from pydantic import BaseModel as _BaseModel


class MockLoginRequest(_BaseModel):
    """Mock login request body — no WeChat code needed."""
    nickname: str | None = None
    avatar_url: str | None = None


@router.post("/mock-login", response_model=dict)
async def mock_login(
    body: MockLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Dev/test mock login: creates user by nickname (no WeChat required).

    If a user with the same nickname already exists, returns that user.
    Otherwise creates a new user with the given nickname.
    """
    nickname = body.nickname or "测试学员"

    # Try to find existing user by nickname
    from sqlalchemy import select as _select
    result = await db.execute(
        _select(User).where(User.nickname == nickname)
    )
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            nickname=nickname,
            avatar_url=body.avatar_url,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    token = create_jwt(user.id)
    user_brief = await user_to_brief(user, db)

    return {
        "code": 0,
        "message": "ok",
        "data": LoginResponse(token=token, user=user_brief).model_dump(),
    }


# ── Current User ────────────────────────────────────────────

@router.get("/me", response_model=dict)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前登录用户信息（需 JWT 鉴权）。"""
    user_brief = await user_to_brief(user, db)
    return {
        "code": 0,
        "message": "ok",
        "data": UserProfileResponse(user=user_brief).model_dump(),
    }
