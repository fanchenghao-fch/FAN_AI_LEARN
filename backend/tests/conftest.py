"""Shared pytest fixtures for backend tests."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a FastAPI TestClient for integration testing."""
    from app.main import app

    return TestClient(app)


@pytest.fixture
def sample_quiz_questions():
    """Sample validated quiz questions for testing analysis."""
    return [
        {
            "id": "q1",
            "type": "choice",
            "content": "Python 中 `None` 的类型是什么？",
            "options": [
                {"key": "A", "text": "NoneType"},
                {"key": "B", "text": "NullType"},
                {"key": "C", "text": "None"},
                {"key": "D", "text": "Void"},
            ],
            "correct_answer": "A",
            "explanation": "Python 中 None 的类型是 NoneType，它是一个单例对象。",
            "source": "Python 官方文档",
            "difficulty": "easy",
        },
        {
            "id": "q2",
            "type": "choice",
            "content": "下列哪种数据结构不是 Python 内置的？",
            "options": [
                {"key": "A", "text": "list"},
                {"key": "B", "text": "dict"},
                {"key": "C", "text": "LinkedList"},
                {"key": "D", "text": "set"},
            ],
            "correct_answer": "C",
            "explanation": "LinkedList 不是 Python 内置类型，需要使用 collections.deque 或自定义实现。",
            "source": "Python 官方文档",
            "difficulty": "medium",
        },
    ]


@pytest.fixture
def sample_user_answers():
    """Sample user answers for testing analysis."""
    return [
        {"question_id": "q1", "user_answer": "A", "is_correct": True, "time_spent": 5},
        {"question_id": "q2", "user_answer": "B", "is_correct": False, "time_spent": 12},
    ]


@pytest.fixture
def sample_generate_request():
    """Sample quiz generation request."""
    return {
        "knowledge_input": "Python 编程基础：变量、数据类型、控制流",
        "input_type": "text",
        "question_count": 5,
        "difficulty": "auto",
        "question_types": ["choice"],
        "enable_search": False,
    }
