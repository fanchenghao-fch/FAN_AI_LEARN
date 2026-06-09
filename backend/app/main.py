"""FastAPI application entry point for the AI Quiz Platform."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.quiz import router as quiz_router
from app.config import settings

app = FastAPI(
    title="AI Quiz Platform API",
    description="AI-powered interactive quiz learning platform",
    version="0.1.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:10086",
        "http://127.0.0.1:10086",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(quiz_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "AI Quiz Platform API",
        "version": "0.1.0",
    }


@app.get("/health")
async def health_check():
    """Health check for Docker / monitoring."""
    return {
        "status": "healthy",
        "deepseek_configured": bool(settings.DEEPSEEK_API_KEY),
    }
