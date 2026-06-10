"""FastAPI application entry point for the AI Quiz Platform."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.quiz import router as quiz_router
from app.api.auth import router as auth_router
from app.config import settings
from app.database import Base, engine
from app.models.user_orm import LevelConfig  # noqa: F401  — ensure table is registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle for the FastAPI app."""
    # Startup: create tables and seed level configs
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _seed_level_configs(conn)

    yield

    # Shutdown: dispose engine
    await engine.dispose()


async def _seed_level_configs(conn):
    """Insert default level configuration if the table is empty."""
    from sqlalchemy import text

    result = await conn.execute(text("SELECT COUNT(*) FROM level_configs"))
    count = result.scalar()
    if count == 0:
        await conn.execute(
            text(
                """
                INSERT INTO level_configs (level, title, min_exp) VALUES
                    (1, '初学萌新', 0),
                    (2, '知识学徒', 100),
                    (3, '学习达人', 300),
                    (4, '百科高手', 600),
                    (5, '博学大师', 1000)
                """
            )
        )


app = FastAPI(
    title="AI Quiz Platform API",
    description="AI-powered interactive quiz learning platform",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server + mini-program webview origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Mini-program webview (servicewechat.com)
        "https://servicewechat.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(quiz_router)
app.include_router(auth_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "AI Quiz Platform API",
        "version": "0.2.0",
    }


@app.get("/health")
async def health_check():
    """Health check for Docker / monitoring."""
    return {
        "status": "healthy",
        "deepseek_configured": bool(settings.DEEPSEEK_API_KEY),
    }
