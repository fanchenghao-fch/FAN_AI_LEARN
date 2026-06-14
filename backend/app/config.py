"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings:
    """Application settings loaded from environment variables."""

    # ── DeepSeek API ──────────────────────────────────────────
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_BASE: str = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
    DEEPSEEK_PRO_MODEL: str = os.getenv("DEEPSEEK_PRO_MODEL", "deepseek-v4-pro")
    DEEPSEEK_FLASH_MODEL: str = os.getenv("DEEPSEEK_FLASH_MODEL", "deepseek-v4-flash")

    # ── Backend ───────────────────────────────────────────────
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")

    # ── MySQL ─────────────────────────────────────────────────
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "quiz_user")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "quiz_platform")

    @property
    def DATABASE_URL(self) -> str:
        """Build async MySQL connection URL for SQLAlchemy."""
        return (
            f"mysql+asyncmy://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            "?charset=utf8mb4"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Build sync MySQL connection URL (for Alembic / admin tasks)."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            "?charset=utf8mb4"
        )

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_DAYS: int = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

    # ── WeChat Mini Program ───────────────────────────────────
    WECHAT_APP_ID: str = os.getenv("WECHAT_APP_ID", "")
    WECHAT_APP_SECRET: str = os.getenv("WECHAT_APP_SECRET", "")

    # ── Quiz defaults ─────────────────────────────────────────
    DEFAULT_QUESTION_COUNT: int = 10
    MAX_QUESTION_COUNT: int = 50
    MIN_QUESTION_COUNT: int = 5
    MAX_INPUT_LENGTH: int = 2000

    # ── Model temperatures ────────────────────────────────────
    GENERATION_TEMPERATURE: float = 0.7
    VALIDATION_TEMPERATURE: float = 0.1
    ANALYSIS_TEMPERATURE: float = 0.5

    # ── Tavily Search ─────────────────────────────────────────
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    SEARCH_TIMEOUT_SECONDS: int = 8
    SEARCH_MAX_CHARS: int = 3000

    # ── Tokens ────────────────────────────────────────────────
    GENERATION_MAX_TOKENS: int = 4096
    VALIDATION_MAX_TOKENS: int = 2048
    ANALYSIS_MAX_TOKENS: int = 2048


settings = Settings()
