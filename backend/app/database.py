"""SQLAlchemy async engine and session management."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# ── Async Engine ────────────────────────────────────────────

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # Set to True for SQL debugging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before using
)

# ── Session Factory ─────────────────────────────────────────

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative Base ────────────────────────────────────────

class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ── Dependency ──────────────────────────────────────────────

async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency: yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
