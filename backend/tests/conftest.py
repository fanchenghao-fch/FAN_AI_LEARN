"""Shared pytest fixtures for backend tests.

Uses SQLite in-memory database for fast, isolated test runs.
No external MySQL dependency required for unit tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db

# Force import of all ORM models so Base.metadata knows about them
import app.models.user_orm  # noqa: F401


# ── Test Database (SQLite in-memory) ─────────────────────────

@pytest.fixture(scope="session")
def test_engine():
    """Session-scoped async SQLite engine."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///./test.db",
        echo=False,
    )
    return engine


@pytest.fixture(autouse=True)
async def setup_database(test_engine):
    """Create all tables before each test, drop after.

    autouse=True ensures every test starts with a clean database.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(test_engine):
    """Provide an async DB session for a single test."""
    test_sessionmaker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with test_sessionmaker() as session:
        yield session


@pytest.fixture
def client(test_engine):
    """Create a FastAPI TestClient that uses the test SQLite database."""
    from app.main import app

    # Override the get_db dependency to use test engine
    test_sessionmaker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db():
        async with test_sessionmaker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()


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
