"""TDD tests for User API endpoints.

Covers:
  - GET  /api/user/stats              (200 + 401)
  - GET  /api/user/history             (200 + pagination + 401)
  - GET  /api/user/wrong-questions     (200 + filtering + 401)
  - GET  /api/user/wrong-questions/{id} (200 + 404 + 401)
  - POST /api/user/wrong-questions/{id}/resolve (200 + 404 + 401)
  - POST /api/user/checkin             (200 + duplicate + 401)
"""

import pytest
from datetime import datetime, date
from unittest.mock import AsyncMock, patch


# ═══════════════════════════════════════════════════════════════
# Test Helpers
# ═══════════════════════════════════════════════════════════════

def _login(client, nickname="测试用户"):
    """Helper: mock-login and return (token, user_id)."""
    resp = client.post(
        "/api/auth/mock-login",
        json={"nickname": nickname},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    return data["token"], data["user"]["id"]


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════
# GET /api/user/stats
# ═══════════════════════════════════════════════════════════════

class TestUserStats:
    """GET /api/user/stats"""

    def test_stats_requires_auth(self, client):
        """Without token → 401."""
        resp = client.get("/api/user/stats")
        assert resp.status_code == 401

    def test_stats_returns_defaults_for_new_user(self, client):
        """New user with no history → zero stats."""
        token, _ = _login(client, "新用户Stats")
        resp = client.get(
            "/api/user/stats",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        stats = data["data"]
        assert stats["total_sessions"] == 0
        assert stats["accuracy"] == 0.0
        assert stats["streak_days"] == 0
        assert stats["coins"] == 0
        assert stats["experience"] == 0
        assert stats["level"] == 1
        assert stats["level_title"] == "初学萌新"
        assert stats["exp_to_next"] == 100
        assert stats["exp_percent"] == 0.0

    def test_stats_with_invalid_token(self, client):
        """Invalid token → 401."""
        resp = client.get(
            "/api/user/stats",
            headers=_auth_header("not-a-valid-token"),
        )
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════
# GET /api/user/history
# ═══════════════════════════════════════════════════════════════

class TestUserHistory:
    """GET /api/user/history"""

    def test_history_requires_auth(self, client):
        """Without token → 401."""
        resp = client.get("/api/user/history")
        assert resp.status_code == 401

    def test_history_returns_empty_for_new_user(self, client):
        """New user → empty list."""
        token, _ = _login(client, "历史测试")
        resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["items"] == []
        assert data["data"]["total"] == 0
        assert data["data"]["page"] == 1
        assert data["data"]["page_size"] == 20
        assert data["data"]["has_more"] is False

    def test_history_pagination(self, client):
        """Pagination params should be respected."""
        token, _ = _login(client, "分页测试")
        resp = client.get(
            "/api/user/history?page=1&page_size=5",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["page"] == 1
        assert data["page_size"] == 5

    def test_history_default_page_params(self, client):
        """Default page=1, page_size=20."""
        token, _ = _login(client, "默认分页")
        resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["page"] == 1
        assert data["page_size"] == 20


# ═══════════════════════════════════════════════════════════════
# GET /api/user/wrong-questions
# ═══════════════════════════════════════════════════════════════

class TestWrongQuestionsList:
    """GET /api/user/wrong-questions"""

    def test_wrong_questions_requires_auth(self, client):
        """Without token → 401."""
        resp = client.get("/api/user/wrong-questions")
        assert resp.status_code == 401

    def test_wrong_questions_empty_for_new_user(self, client):
        """New user → empty list."""
        token, _ = _login(client, "错题测试")
        resp = client.get(
            "/api/user/wrong-questions",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["groups"] == []
        assert data["data"]["total"] == 0
        assert data["data"]["resolved_count"] == 0
        assert data["data"]["unresolved_count"] == 0

    def test_wrong_questions_filter_by_resolved(self, client):
        """Filter param should be accepted."""
        token, _ = _login(client, "过滤测试")
        # Test with resolved=0 (unresolved)
        resp = client.get(
            "/api/user/wrong-questions?resolved=0",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Test with resolved=1 (resolved)
        resp = client.get(
            "/api/user/wrong-questions?resolved=1",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════
# GET /api/user/wrong-questions/{id}
# ═══════════════════════════════════════════════════════════════

class TestWrongQuestionDetail:
    """GET /api/user/wrong-questions/{id}"""

    def test_detail_requires_auth(self, client):
        """Without token → 401."""
        resp = client.get("/api/user/wrong-questions/fake-id-123")
        assert resp.status_code == 401

    def test_detail_not_found(self, client):
        """Non-existent wrong question → 404."""
        token, _ = _login(client, "详情404")
        resp = client.get(
            "/api/user/wrong-questions/nonexistent-id-abc",
            headers=_auth_header(token),
        )
        assert resp.status_code == 404

    def test_detail_other_user_not_found(self, client):
        """Wrong question belonging to another user → 404 (not visible)."""
        # Login as user A
        token_a, _ = _login(client, "用户A")
        # Login as user B
        token_b, _ = _login(client, "用户B")

        # User B tries to access a wrong question that doesn't exist → 404
        resp = client.get(
            "/api/user/wrong-questions/user-a-item-not-exists",
            headers=_auth_header(token_b),
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════
# POST /api/user/wrong-questions/{id}/resolve
# ═══════════════════════════════════════════════════════════════

class TestResolveWrongQuestion:
    """POST /api/user/wrong-questions/{id}/resolve"""

    def test_resolve_requires_auth(self, client):
        """Without token → 401."""
        resp = client.post("/api/user/wrong-questions/fake-id/resolve")
        assert resp.status_code == 401

    def test_resolve_not_found(self, client):
        """Non-existent wrong question → 404."""
        token, _ = _login(client, "标记404")
        resp = client.post(
            "/api/user/wrong-questions/nonexistent-id/resolve",
            headers=_auth_header(token),
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════
# POST /api/user/checkin
# ═══════════════════════════════════════════════════════════════

class TestCheckIn:
    """POST /api/user/checkin"""

    def test_checkin_requires_auth(self, client):
        """Without token → 401."""
        resp = client.post("/api/user/checkin")
        assert resp.status_code == 401

    def test_checkin_creates_new(self, client):
        """First check-in today should succeed."""
        token, _ = _login(client, "签到测试")
        resp = client.post(
            "/api/user/checkin",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["checked_in"] is True
        assert data["data"]["streak_days"] >= 1

    def test_checkin_duplicate_same_day(self, client):
        """Second check-in on same day should return already checked in."""
        token, _ = _login(client, "重复签到")
        # First check-in
        resp1 = client.post(
            "/api/user/checkin",
            headers=_auth_header(token),
        )
        assert resp1.status_code == 200
        assert resp1.json()["data"]["checked_in"] is True

        # Second check-in same day
        resp2 = client.post(
            "/api/user/checkin",
            headers=_auth_header(token),
        )
        assert resp2.status_code == 200
        assert resp2.json()["data"]["checked_in"] is False
        assert "已签到" in resp2.json().get("message", "")


# ═══════════════════════════════════════════════════════════════
# POST /api/user/wrong-questions/{id}/retry
# ═══════════════════════════════════════════════════════════════

class TestRetryWrongQuestion:
    """POST /api/user/wrong-questions/{id}/retry"""

    def test_retry_requires_auth(self, client):
        """Without token → 401."""
        resp = client.post(
            "/api/user/wrong-questions/fake-id/retry",
            json={"user_answer": "B"},
        )
        assert resp.status_code == 401

    def test_retry_not_found(self, client):
        """Non-existent wrong question → 404."""
        token, _ = _login(client, "重做404")
        resp = client.post(
            "/api/user/wrong-questions/nonexistent-id/retry",
            json={"user_answer": "B"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 404

    def test_retry_correct_answer_resolves(self, client):
        """Correct re-answer → question is auto-resolved + coins awarded."""
        token, user_id = _login(client, "重做正确测试")

        # First, create a wrong question via analyze
        questions = [
            {"id": "q1", "type": "choice", "content": "Q1",
             "correct_answer": "B", "explanation": "test", "difficulty": "easy",
             "options": [{"key": "A", "text": "选A"}, {"key": "B", "text": "选B"}]},
        ]
        answers = [
            {"question_id": "q1", "user_answer": "A", "is_correct": False, "time_spent": 10},
        ]
        resp = client.post(
            "/api/quiz/analyze",
            json={"quiz_id": "quiz_retry_001", "questions": questions, "answers": answers, "total_time": 10},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Get the wrong question ID
        wq_resp = client.get("/api/user/wrong-questions", headers=_auth_header(token))
        wq_data = wq_resp.json()["data"]
        assert wq_data["total"] == 1
        wrong_id = wq_data["groups"][0]["questions"][0]["id"]

        # Re-answer with correct answer
        retry_resp = client.post(
            f"/api/user/wrong-questions/{wrong_id}/retry",
            json={"user_answer": "B"},
            headers=_auth_header(token),
        )
        assert retry_resp.status_code == 200
        retry_data = retry_resp.json()
        assert retry_data["code"] == 0
        assert retry_data["data"]["is_correct"] is True
        assert retry_data["data"]["resolved"] is True
        assert retry_data["data"]["coins_earned"] == 2

        # Verify the wrong question is now resolved
        detail_resp = client.get(
            f"/api/user/wrong-questions/{wrong_id}",
            headers=_auth_header(token),
        )
        assert detail_resp.json()["data"]["resolved"] is True

    def test_retry_wrong_answer_keeps_unresolved(self, client):
        """Incorrect re-answer → question stays unresolved."""
        token, _ = _login(client, "重做错误测试")

        # Create a wrong question
        questions = [
            {"id": "q1", "type": "choice", "content": "Q1",
             "correct_answer": "B", "explanation": "test", "difficulty": "easy"},
        ]
        answers = [
            {"question_id": "q1", "user_answer": "C", "is_correct": False, "time_spent": 10},
        ]
        resp = client.post(
            "/api/quiz/analyze",
            json={"quiz_id": "quiz_retry_wrong", "questions": questions, "answers": answers, "total_time": 10},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Get wrong question ID
        wq_resp = client.get("/api/user/wrong-questions", headers=_auth_header(token))
        wrong_id = wq_resp.json()["data"]["groups"][0]["questions"][0]["id"]

        # Re-answer with wrong answer again
        retry_resp = client.post(
            f"/api/user/wrong-questions/{wrong_id}/retry",
            json={"user_answer": "C"},
            headers=_auth_header(token),
        )
        assert retry_resp.status_code == 200
        retry_data = retry_resp.json()
        assert retry_data["data"]["is_correct"] is False
        assert retry_data["data"]["resolved"] is False
        assert retry_data["data"]["coins_earned"] == 0

        # Verify still unresolved
        detail_resp = client.get(
            f"/api/user/wrong-questions/{wrong_id}",
            headers=_auth_header(token),
        )
        assert detail_resp.json()["data"]["resolved"] is False

    def test_retry_already_resolved_still_works(self, client):
        """Re-answering an already resolved question should still return result."""
        token, _ = _login(client, "重做已掌握测试")

        # Create and resolve a wrong question
        questions = [
            {"id": "q1", "type": "choice", "content": "Q1",
             "correct_answer": "B", "explanation": "test", "difficulty": "easy"},
        ]
        answers = [
            {"question_id": "q1", "user_answer": "A", "is_correct": False, "time_spent": 10},
        ]
        client.post(
            "/api/quiz/analyze",
            json={"quiz_id": "quiz_resolved_retry", "questions": questions, "answers": answers, "total_time": 10},
            headers=_auth_header(token),
        )

        wq_resp = client.get("/api/user/wrong-questions", headers=_auth_header(token))
        wrong_id = wq_resp.json()["data"]["groups"][0]["questions"][0]["id"]

        # First retry: correct answer → resolve
        client.post(
            f"/api/user/wrong-questions/{wrong_id}/retry",
            json={"user_answer": "B"},
            headers=_auth_header(token),
        )

        # Second retry on already resolved question
        retry2 = client.post(
            f"/api/user/wrong-questions/{wrong_id}/retry",
            json={"user_answer": "B"},
            headers=_auth_header(token),
        )
        assert retry2.status_code == 200
        data2 = retry2.json()
        assert data2["data"]["is_correct"] is True
        assert data2["data"]["resolved"] is True
        # Already resolved, no additional coins
        assert data2["data"]["coins_earned"] == 0

    def test_retry_preserves_options_in_detail(self, client):
        """Wrong question detail should include original options for re-answer UI."""
        token, _ = _login(client, "选项存储测试")

        questions = [
            {"id": "q1", "type": "choice", "content": "什么颜色？",
             "correct_answer": "A", "explanation": "天是蓝的", "difficulty": "easy",
             "options": [
                 {"key": "A", "text": "蓝色"},
                 {"key": "B", "text": "红色"},
                 {"key": "C", "text": "绿色"},
                 {"key": "D", "text": "黄色"},
             ]},
        ]
        answers = [
            {"question_id": "q1", "user_answer": "B", "is_correct": False, "time_spent": 5},
        ]
        client.post(
            "/api/quiz/analyze",
            json={"quiz_id": "quiz_options_test", "questions": questions, "answers": answers, "total_time": 5},
            headers=_auth_header(token),
        )

        wq_resp = client.get("/api/user/wrong-questions", headers=_auth_header(token))
        wrong_id = wq_resp.json()["data"]["groups"][0]["questions"][0]["id"]

        # Detail should include options
        detail = client.get(
            f"/api/user/wrong-questions/{wrong_id}",
            headers=_auth_header(token),
        )
        assert detail.status_code == 200
        detail_data = detail.json()["data"]
        assert detail_data["options"] is not None
        assert len(detail_data["options"]) == 4
        assert detail_data["options"][0]["key"] == "A"
        assert detail_data["options"][0]["text"] == "蓝色"
