"""SQLAlchemy ORM models for user system.

Table mapping (from init.sql):
  users           → User
  quiz_sessions   → QuizSessionRecord  (distinct from Pydantic QuizSession)
  wrong_questions → WrongQuestion
  check_ins       → CheckIn
  level_configs   → LevelConfig
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── UUID Helper ───────────────────────────────────────────────

def new_uuid() -> str:
    return uuid.uuid4().hex


# ═══════════════════════════════════════════════════════════════
# 1. User
# ═══════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    open_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    union_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nickname: Mapped[str] = mapped_column(
        String(64), nullable=False, default="灯灯学员"
    )
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    experience: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )

    # ── Relationships ────────────────────────────────────
    quiz_sessions: Mapped[list["QuizSessionRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    wrong_questions: Mapped[list["WrongQuestion"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    check_ins: Mapped[list["CheckIn"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, nickname={self.nickname!r})>"


# ═══════════════════════════════════════════════════════════════
# 2. Quiz Session Record
# ═══════════════════════════════════════════════════════════════

class QuizSessionRecord(Base):
    __tablename__ = "quiz_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quiz_id: Mapped[str] = mapped_column(String(64), nullable=False)
    domain: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    title: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    time_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coins_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    combo_max: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    # ── Relationships ────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="quiz_sessions")
    wrong_questions: Mapped[list["WrongQuestion"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

    # ── Indexes ──────────────────────────────────────────
    __table_args__ = (
        Index("idx_user_id", "user_id"),
        Index("idx_user_created", "user_id", "created_at"),
        Index("idx_quiz_id", "quiz_id"),
    )

    def __repr__(self) -> str:
        return f"<QuizSessionRecord(id={self.id}, user_id={self.user_id})>"


# ═══════════════════════════════════════════════════════════════
# 3. Wrong Question
# ═══════════════════════════════════════════════════════════════

class WrongQuestion(Base):
    __tablename__ = "wrong_questions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    user_answer: Mapped[str] = mapped_column(String(512), nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(512), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    options: Mapped[str | None] = mapped_column(Text, nullable=True, comment="JSON-serialised original answer options")
    resolved: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ── Relationships ────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="wrong_questions")
    session: Mapped["QuizSessionRecord"] = relationship(back_populates="wrong_questions")

    # ── Indexes ──────────────────────────────────────────
    __table_args__ = (
        Index("idx_user_domain", "user_id", "domain"),
        Index("idx_user_resolved", "user_id", "resolved"),
        Index("idx_user_question", "user_id", "question_id"),
    )

    def __repr__(self) -> str:
        return f"<WrongQuestion(id={self.id}, resolved={self.resolved})>"


# ═══════════════════════════════════════════════════════════════
# 4. CheckIn
# ═══════════════════════════════════════════════════════════════

class CheckIn(Base):
    __tablename__ = "check_ins"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    check_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    # ── Relationships ────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="check_ins")

    # ── Indexes ──────────────────────────────────────────
    __table_args__ = (
        UniqueConstraint("user_id", "check_date", name="uk_user_date"),
        Index("idx_user_id_checkins", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<CheckIn(user_id={self.user_id}, date={self.check_date})>"


# ═══════════════════════════════════════════════════════════════
# 5. Level Config
# ═══════════════════════════════════════════════════════════════

class LevelConfig(Base):
    __tablename__ = "level_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(32), nullable=False)
    min_exp: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        return f"<LevelConfig(level={self.level}, title={self.title!r})>"
