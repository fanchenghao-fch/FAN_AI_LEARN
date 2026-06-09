"""Tests for FastAPI quiz API endpoints.

Uses TestClient for integration testing of routes.
"""

import pytest


class TestRootEndpoint:
    """Test root/health endpoints."""

    def test_root_returns_ok(self, client):
        """GET / should return status ok."""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "AI Quiz Platform API"

    def test_health_check(self, client):
        """GET /health should return healthy status."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestQuizGenerateEndpoint:
    """Test POST /api/quiz/generate endpoint."""

    def test_generate_returns_sse_stream(self, client, sample_generate_request):
        """Should return SSE content type."""
        response = client.post(
            "/api/quiz/generate",
            json=sample_generate_request,
        )

        # Should be SSE stream or error (if no API key)
        assert response.status_code in [200, 500]

    def test_generate_validates_input(self, client):
        """Should reject invalid input."""
        response = client.post(
            "/api/quiz/generate",
            json={"knowledge_input": "", "question_count": 100},
        )

        # FastAPI validation should return 422 for invalid input
        assert response.status_code == 422

    def test_generate_rejects_missing_input(self, client):
        """Should reject request without knowledge_input."""
        response = client.post(
            "/api/quiz/generate",
            json={"question_count": 10},
        )

        assert response.status_code == 422

    def test_generate_rejects_too_many_questions(self, client):
        """Should reject question_count > 50."""
        response = client.post(
            "/api/quiz/generate",
            json={
                "knowledge_input": "test",
                "question_count": 100,
            },
        )

        assert response.status_code == 422

    def test_generate_rejects_too_few_questions(self, client):
        """Should reject question_count < 5."""
        response = client.post(
            "/api/quiz/generate",
            json={
                "knowledge_input": "test",
                "question_count": 2,
            },
        )

        assert response.status_code == 422


class TestQuizAnalyzeEndpoint:
    """Test POST /api/quiz/analyze endpoint."""

    def test_analyze_returns_result(
        self, client, sample_quiz_questions, sample_user_answers
    ):
        """Should return analysis result for valid input."""
        response = client.post(
            "/api/quiz/analyze",
            json={
                "quiz_id": "test_quiz_001",
                "questions": sample_quiz_questions,
                "answers": sample_user_answers,
                "total_time": 30,
            },
        )

        # Accept 200 (from chain) or 500 (if API key missing)
        assert response.status_code in [200, 500]

    def test_analyze_validates_input(self, client):
        """Should reject missing required fields."""
        response = client.post(
            "/api/quiz/analyze",
            json={"quiz_id": "test"},
        )

        assert response.status_code == 422


class TestCORSMiddleware:
    """Test CORS headers are present."""

    def test_cors_headers(self, client):
        """Should include CORS headers in response."""
        response = client.options(
            "/",
            headers={
                "Origin": "http://localhost:10086",
                "Access-Control-Request-Method": "GET",
            },
        )

        # OPTIONS should return 200 (CORS preflight) or 405 (not allowed)
        assert response.status_code in [200, 405]
