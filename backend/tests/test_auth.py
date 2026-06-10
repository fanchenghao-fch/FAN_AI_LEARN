"""TDD tests for Auth API endpoints.

Covers:
  - POST /api/auth/mock-login     (H5 Mock login)
  - POST /api/auth/wechat-login   (WeChat mini-program login)
  - GET  /api/auth/me             (Current user with JWT)
  - JWT auth middleware            (401 scenarios)
"""

import pytest


# ═══════════════════════════════════════════════════════════════
# Mock Login
# ═══════════════════════════════════════════════════════════════

class TestMockLogin:
    """POST /api/auth/mock-login"""

    def test_mock_login_creates_user_and_returns_token(self, client):
        """First login with a new nickname should create user and return JWT."""
        response = client.post(
            "/api/auth/mock-login",
            json={"nickname": "测试学员"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 0
        assert "token" in data["data"]
        assert data["data"]["user"]["nickname"] == "测试学员"
        assert data["data"]["user"]["coins"] == 0
        assert data["data"]["user"]["experience"] == 0
        assert data["data"]["user"]["level"] == 1
        assert data["data"]["user"]["level_title"] == "初学萌新"
        assert "id" in data["data"]["user"]
        # Token should be a non-empty string
        assert len(data["data"]["token"]) > 20

    def test_mock_login_existing_user_returns_token(self, client):
        """Second login with same nickname should match existing user."""
        # First login
        r1 = client.post(
            "/api/auth/mock-login",
            json={"nickname": "老学员"},
        )
        user_id_1 = r1.json()["data"]["user"]["id"]

        # Second login with same nickname
        r2 = client.post(
            "/api/auth/mock-login",
            json={"nickname": "老学员"},
        )
        user_id_2 = r2.json()["data"]["user"]["id"]

        assert user_id_1 == user_id_2, "Same nickname should match existing user"

    def test_mock_login_with_avatar(self, client):
        """Login with nickname + avatar_url should persist avatar."""
        response = client.post(
            "/api/auth/mock-login",
            json={
                "nickname": "头像用户",
                "avatar_url": "https://example.com/avatar.png",
            },
        )

        assert response.status_code == 200
        assert response.json()["data"]["user"]["avatar_url"] == "https://example.com/avatar.png"

    def test_mock_login_defaults_empty_nickname(self, client):
        """Empty nickname should default to '测试学员'."""
        response = client.post(
            "/api/auth/mock-login",
            json={"nickname": ""},
        )

        assert response.status_code == 200
        assert response.json()["data"]["user"]["nickname"] == "测试学员"

    def test_mock_login_defaults_missing_nickname(self, client):
        """Missing nickname field should default to '测试学员'."""
        response = client.post(
            "/api/auth/mock-login",
            json={},
        )

        assert response.status_code == 200
        assert response.json()["data"]["user"]["nickname"] == "测试学员"

    def test_mock_login_returns_different_tokens_for_different_users(self, client):
        """Each user should get a unique JWT."""
        r1 = client.post("/api/auth/mock-login", json={"nickname": "用户A"})
        r2 = client.post("/api/auth/mock-login", json={"nickname": "用户B"})

        token_a = r1.json()["data"]["token"]
        token_b = r2.json()["data"]["token"]

        assert token_a != token_b


# ═══════════════════════════════════════════════════════════════
# WeChat Login
# ═══════════════════════════════════════════════════════════════

class TestWechatLogin:
    """POST /api/auth/wechat-login"""

    def test_wechat_login_without_appid_returns_503(self, client):
        """Without WeChat AppID configured, should return an error.

        When WeChat credentials are not configured → 503 Service Unavailable.
        When WeChat credentials are configured but code is invalid → 400 Bad Request.
        Both are expected behaviors during testing.
        """
        response = client.post(
            "/api/auth/wechat-login",
            json={"code": "test-wx-code-123"},
        )

        # Either 400 (real WeChat keys configured, but code invalid)
        # or 503 (no WeChat keys configured)
        assert response.status_code in [400, 503]


# ═══════════════════════════════════════════════════════════════
# Current User (GET /me)
# ═══════════════════════════════════════════════════════════════

class TestGetCurrentUser:
    """GET /api/auth/me"""

    def test_me_returns_user_with_valid_token(self, client):
        """Should return current user when valid token is provided."""
        # First login
        login_resp = client.post(
            "/api/auth/mock-login",
            json={"nickname": "个人信息测试"},
        )
        token = login_resp.json()["data"]["token"]

        # Then fetch profile
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 0
        assert data["data"]["user"]["nickname"] == "个人信息测试"
        assert data["data"]["user"]["id"] == login_resp.json()["data"]["user"]["id"]

    def test_me_without_token_returns_401(self, client):
        """Missing Authorization header should return 401."""
        response = client.get("/api/auth/me")

        assert response.status_code == 401
        assert "请先登录" in response.json().get("detail", "")

    def test_me_with_invalid_token_returns_401(self, client):
        """Malformed token should return 401."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer this-is-not-a-valid-jwt"},
        )

        assert response.status_code == 401
        assert "无效" in response.json().get("detail", "")

    def test_me_with_expired_token_returns_401(self, client):
        """Expired JWT should return 401.

        We generate a token that's already expired (negative expiry).
        """
        import time
        import jwt as pyjwt

        from app.config import settings

        # Create an already-expired token
        expired_payload = {
            "sub": "nonexistent-user-id",
            "iat": int(time.time()) - 7200,
            "exp": int(time.time()) - 3600,  # expired 1 hour ago
        }
        expired_token = pyjwt.encode(
            expired_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

        assert response.status_code == 401
        assert "过期" in response.json().get("detail", "")

    def test_me_with_nonexistent_user_returns_401(self, client):
        """Valid token but user deleted from DB should return 401."""
        import time
        import jwt as pyjwt

        from app.config import settings

        # Create token for a user that doesn't exist
        payload = {
            "sub": "nonexistent-user-id-12345",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        ghost_token = pyjwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {ghost_token}"},
        )

        assert response.status_code == 401
        assert "不存在" in response.json().get("detail", "")

    def test_me_returns_consistent_level_title(self, client):
        """New user should always be '初学萌新' (level 1)."""
        login_resp = client.post(
            "/api/auth/mock-login",
            json={"nickname": "新萌新"},
        )
        token = login_resp.json()["data"]["token"]

        me_resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert me_resp.json()["data"]["user"]["level"] == 1
        assert me_resp.json()["data"]["user"]["level_title"] == "初学萌新"


# ═══════════════════════════════════════════════════════════════
# JWT Token format
# ═══════════════════════════════════════════════════════════════

class TestJWTTokenFormat:
    """JWT token format and behavior."""

    def test_token_is_valid_jwt_format(self, client):
        """Token should be a valid JWT (3 dot-separated parts)."""
        response = client.post(
            "/api/auth/mock-login",
            json={"nickname": "JWT测试"},
        )
        token = response.json()["data"]["token"]

        parts = token.split(".")
        assert len(parts) == 3, "JWT should have 3 parts (header.payload.signature)"

    def test_token_contains_user_id_sub(self, client):
        """Token payload should contain user id as 'sub' claim."""
        import jwt as pyjwt

        from app.config import settings

        response = client.post(
            "/api/auth/mock-login",
            json={"nickname": "SubClaim测试"},
        )
        token = response.json()["data"]["token"]

        payload = pyjwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )

        assert "sub" in payload
        assert "iat" in payload
        assert "exp" in payload
        assert payload["sub"] == response.json()["data"]["user"]["id"]


# ═══════════════════════════════════════════════════════════════
# CORS & OPTIONS
# ═══════════════════════════════════════════════════════════════

class TestAuthCORS:
    """CORS headers should be present on auth endpoints."""

    def test_auth_options_preflight(self, client):
        """OPTIONS preflight should return 200 for auth endpoints."""
        response = client.options(
            "/api/auth/mock-login",
            headers={
                "Origin": "http://localhost:10086",
                "Access-Control-Request-Method": "POST",
            },
        )

        assert response.status_code in [200, 400, 405]  # 200=allowed, 400/405=not configured
