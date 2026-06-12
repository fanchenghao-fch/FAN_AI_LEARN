"""TDD tests for analyze endpoint with authenticated user.

Verifies that when a logged-in user submits quiz answers:
  1. QuizSessionRecord is created
  2. WrongQuestion records are created for incorrect answers
  3. CheckIn is created for today
  4. Coins are awarded
  5. Experience is awarded
  6. User level may update
  7. Anonymous users still get analysis results (no saving)
"""

import pytest


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def _login(client, nickname="分析测试"):
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


def _analyze_payload(quiz_id="quiz_test123", questions=None, answers=None):
    """Build a standard analyze request payload."""
    if questions is None:
        questions = [
            {"id": "q1", "type": "choice", "content": "2+2=?", "correct_answer": "A", "explanation": "2+2=4", "difficulty": "easy"},
            {"id": "q2", "type": "choice", "content": "3+3=?", "correct_answer": "B", "explanation": "3+3=6", "difficulty": "medium"},
            {"id": "q3", "type": "truefalse", "content": "1+1=3?", "correct_answer": "错误", "explanation": "1+1=2", "difficulty": "easy"},
        ]
    if answers is None:
        answers = [
            {"question_id": "q1", "user_answer": "A", "is_correct": True, "time_spent": 5},
            {"question_id": "q2", "user_answer": "A", "is_correct": False, "time_spent": 8},
            {"question_id": "q3", "user_answer": "正确", "is_correct": False, "time_spent": 3},
        ]
    return {
        "quiz_id": quiz_id,
        "questions": questions,
        "answers": answers,
        "total_time": 16,
    }


# ═══════════════════════════════════════════════════════════════
# Authenticated User Analyze Tests
# ═══════════════════════════════════════════════════════════════

class TestAnalyzeWithUser:
    """POST /api/quiz/analyze with authenticated user."""

    def test_analyze_creates_session_record(self, client):
        """Logged-in user → QuizSessionRecord should be created."""
        token, user_id = _login(client, "SessionRecord测试")

        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_sess_001"),
            headers=_auth_header(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0

        # Verify reward info is returned
        assert "reward" in data["data"]
        assert data["data"]["reward"]["coins_earned"] > 0

    def test_analyze_creates_wrong_questions(self, client):
        """Logged-in user → WrongQuestion records for incorrect answers."""
        token, user_id = _login(client, "WrongQ测试")

        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_wq_001"),
            headers=_auth_header(token),
        )

        assert resp.status_code == 200

        # Verify wrong questions exist via the user API
        wq_resp = client.get(
            "/api/user/wrong-questions",
            headers=_auth_header(token),
        )
        assert wq_resp.status_code == 200
        wq_data = wq_resp.json()["data"]
        # 2 wrong answers in the payload: q2 and q3
        assert wq_data["total"] == 2

    def test_analyze_creates_checkin(self, client):
        """Logged-in user → today's check-in should be created."""
        token, user_id = _login(client, "Checkin测试")

        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_checkin_001"),
            headers=_auth_header(token),
        )

        assert resp.status_code == 200
        assert resp.json()["data"]["reward"]["is_first_today"] is True

    def test_analyze_awards_coins(self, client):
        """Logged-in user → coins should increase."""
        token, user_id = _login(client, "金币测试")

        # Check initial coins
        me_before = client.get("/api/auth/me", headers=_auth_header(token))
        coins_before = me_before.json()["data"]["user"]["coins"]

        # Submit quiz
        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_coins_001"),
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Check coins after
        me_after = client.get("/api/auth/me", headers=_auth_header(token))
        coins_after = me_after.json()["data"]["user"]["coins"]

        assert coins_after > coins_before
        assert coins_after == coins_before + resp.json()["data"]["reward"]["coins_earned"]

    def test_analyze_awards_experience(self, client):
        """Logged-in user → experience should increase."""
        token, user_id = _login(client, "经验测试")

        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_exp_001"),
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Check experience
        me = client.get("/api/auth/me", headers=_auth_header(token))
        exp = me.json()["data"]["user"]["experience"]

        assert exp == resp.json()["data"]["reward"]["experience_earned"]

    def test_analyze_anonymous_gets_result_without_reward(self, client):
        """Anonymous user → still get analysis, but no reward."""
        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_anon_001"),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        # Should still have analysis data
        assert "score" in data["data"]
        # Reward should be minimal/zero
        assert data["data"].get("reward", {}).get("coins_earned", 0) == 0

    def test_analyze_all_correct(self, client):
        """All correct answers → no wrong questions created."""
        token, user_id = _login(client, "全对测试")

        questions = [
            {"id": "q1", "type": "choice", "content": "Q1", "correct_answer": "A", "explanation": "...", "difficulty": "easy"},
            {"id": "q2", "type": "choice", "content": "Q2", "correct_answer": "B", "explanation": "...", "difficulty": "easy"},
        ]
        answers = [
            {"question_id": "q1", "user_answer": "A", "is_correct": True, "time_spent": 3},
            {"question_id": "q2", "user_answer": "B", "is_correct": True, "time_spent": 4},
        ]

        resp = client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_perfect", questions, answers),
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # No wrong questions
        wq_resp = client.get(
            "/api/user/wrong-questions",
            headers=_auth_header(token),
        )
        assert wq_resp.json()["data"]["total"] == 0

    def test_history_appears_after_analyze(self, client):
        """After analyze, the session should appear in user history."""
        token, user_id = _login(client, "历史出现测试")

        client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_hist_001"),
            headers=_auth_header(token),
        )

        hist_resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        assert hist_resp.status_code == 200
        hist_data = hist_resp.json()["data"]
        assert hist_data["total"] == 1
        assert hist_data["items"][0]["quiz_id"] == "quiz_hist_001"

    def test_stats_update_after_analyze(self, client):
        """After analyze, stats should reflect the new session."""
        token, user_id = _login(client, "统计更新测试")

        client.post(
            "/api/quiz/analyze",
            json=_analyze_payload("quiz_stats_001"),
            headers=_auth_header(token),
        )

        stats_resp = client.get(
            "/api/user/stats",
            headers=_auth_header(token),
        )
        stats = stats_resp.json()["data"]
        assert stats["total_sessions"] == 1
        assert stats["accuracy"] > 0
        assert stats["streak_days"] >= 1

    def test_knowledge_domain_stored_in_session(self, client):
        """knowledge_domain from analyze request → stored in session record."""
        token, user_id = _login(client, "领域存储测试")

        payload = _analyze_payload("quiz_domain_001")
        payload["knowledge_domain"] = "Python编程基础"

        resp = client.post(
            "/api/quiz/analyze",
            json=payload,
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Verify domain appears in history
        hist_resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        assert hist_resp.status_code == 200
        items = hist_resp.json()["data"]["items"]
        assert len(items) == 1
        assert items[0]["domain"] == "Python编程基础"

        # Verify domain appears in session detail
        detail_resp = client.get(
            f"/api/user/sessions/{items[0]['session_id']}",
            headers=_auth_header(token),
        )
        assert detail_resp.status_code == 200
        assert detail_resp.json()["data"]["domain"] == "Python编程基础"

    def test_knowledge_domain_defaults_to_comprehensive(self, client):
        """When knowledge_domain is not provided, it defaults to '综合'."""
        token, user_id = _login(client, "默认领域测试")

        payload = _analyze_payload("quiz_nodefault_001")
        # Do NOT set knowledge_domain

        resp = client.post(
            "/api/quiz/analyze",
            json=payload,
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        hist_resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        assert hist_resp.status_code == 200
        items = hist_resp.json()["data"]["items"]
        assert items[0]["domain"] == "综合"

    def test_knowledge_input_stored_in_session(self, client):
        """knowledge_input from analyze request → stored in session record."""
        token, user_id = _login(client, "输入存储测试")

        payload = _analyze_payload("quiz_input_001")
        payload["knowledge_input"] = "Python面试高频题：装饰器、生成器、上下文管理器"

        resp = client.post(
            "/api/quiz/analyze",
            json=payload,
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        # Verify knowledge_input appears in history
        hist_resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        assert hist_resp.status_code == 200
        items = hist_resp.json()["data"]["items"]
        assert len(items) == 1
        assert items[0]["knowledge_input"] == "Python面试高频题：装饰器、生成器、上下文管理器"

        # Verify knowledge_input appears in session detail
        detail_resp = client.get(
            f"/api/user/sessions/{items[0]['session_id']}",
            headers=_auth_header(token),
        )
        assert detail_resp.status_code == 200
        assert detail_resp.json()["data"]["knowledge_input"] == "Python面试高频题：装饰器、生成器、上下文管理器"

    def test_knowledge_input_null_when_not_provided(self, client):
        """When knowledge_input is not provided, it should be None."""
        token, user_id = _login(client, "无输入测试")

        payload = _analyze_payload("quiz_noinput_001")
        # Do NOT set knowledge_input

        resp = client.post(
            "/api/quiz/analyze",
            json=payload,
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        hist_resp = client.get(
            "/api/user/history",
            headers=_auth_header(token),
        )
        items = hist_resp.json()["data"]["items"]
        assert items[0]["knowledge_input"] is None
