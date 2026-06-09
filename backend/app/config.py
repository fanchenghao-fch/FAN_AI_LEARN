"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings:
    """Application settings loaded from environment variables."""

    # DeepSeek API
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_BASE: str = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
    DEEPSEEK_PRO_MODEL: str = os.getenv("DEEPSEEK_PRO_MODEL", "deepseek-v4-pro")
    DEEPSEEK_FLASH_MODEL: str = os.getenv("DEEPSEEK_FLASH_MODEL", "deepseek-v4-flash")

    # Backend
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")

    # Quiz defaults
    DEFAULT_QUESTION_COUNT: int = 10
    MAX_QUESTION_COUNT: int = 50
    MIN_QUESTION_COUNT: int = 5
    MAX_INPUT_LENGTH: int = 2000

    # Model temperatures
    GENERATION_TEMPERATURE: float = 0.7
    VALIDATION_TEMPERATURE: float = 0.1
    ANALYSIS_TEMPERATURE: float = 0.5

    # Tokens
    GENERATION_MAX_TOKENS: int = 4096
    VALIDATION_MAX_TOKENS: int = 2048
    ANALYSIS_MAX_TOKENS: int = 2048


settings = Settings()
