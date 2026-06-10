"""Auth API routes: login (Mock + WeChat) and current user."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user_schemas import (
    LoginResponse,
    MockLoginRequest,
    UserProfileResponse,
    WechatLoginRequest,
)
from app.services.auth import (
    create_jwt,
    get_current_user,
    get_or_create_mock_user,
    get_or_create_wechat_user,
    user_to_brief,
    wechat_code_to_openid,
)
from app.models.user_orm import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Mock Login (H5) ─────────────────────────────────────────

@router.post("/mock-login", response_model=dict)
async def mock_login(
    body: MockLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """H5 Mock 登录：输入昵称即可登录（仅开发/演示用途）。"""
    user = await get_or_create_mock_user(db, body.nickname, body.avatar_url)
    token = create_jwt(user.id)
    user_brief = await user_to_brief(user, db)

    return {
        "code": 0,
        "message": "ok",
        "data": LoginResponse(token=token, user=user_brief).model_dump(),
    }


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
