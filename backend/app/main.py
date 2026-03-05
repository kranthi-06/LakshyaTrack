from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

from app.db.session import engine
from app.db.base_class import Base
from app.models.user import User # Import to ensure registered
from app.models.career import (  # New career platform models
    Roadmap, QuizAttempt, InterviewSession, MultiStageInterview,
    Opportunity, ProgressSnapshot, LearningCache
)

# Create tables on startup
Base.metadata.create_all(bind=engine)

# ── Auto-migrate: add new columns that create_all won't add to existing tables ──
from sqlalchemy import inspect, text
with engine.connect() as conn:
    inspector = inspect(engine)
    existing_cols = [c['name'] for c in inspector.get_columns('profiles')]
    if 'profile_photo_url' not in existing_cols:
        conn.execute(text("ALTER TABLE profiles ADD COLUMN profile_photo_url VARCHAR"))
        conn.commit()

    # Multi-roadmap support: add new columns to roadmaps table
    roadmap_cols = [c['name'] for c in inspector.get_columns('roadmaps')]
    if 'topic_name' not in roadmap_cols:
        conn.execute(text("ALTER TABLE roadmaps ADD COLUMN topic_name VARCHAR"))
        conn.commit()
    if 'last_opened' not in roadmap_cols:
        conn.execute(text("ALTER TABLE roadmaps ADD COLUMN last_opened TIMESTAMPTZ DEFAULT NOW()"))
        conn.commit()


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip Compression — compress responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Initialize Background Jobs
from app.core.background_jobs import setup_background_jobs

@app.on_event("startup")
async def startup_event():
    setup_background_jobs()

# Exception Handler for Detailed Logs
from fastapi import Request
from fastapi.responses import JSONResponse
import logging
import traceback
import sys

# Configure logging
logging.basicConfig(
    stream=sys.stdout, 
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)
logger = logging.getLogger(__name__)

# ── Request Timing Middleware (performance monitoring) ──
import time
from starlette.middleware.base import BaseHTTPMiddleware

class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
        if duration_ms > 1000:
            logger.warning(f"SLOW REQUEST: {request.method} {request.url.path} took {duration_ms:.0f}ms")
        return response

app.add_middleware(RequestTimingMiddleware)

@app.exception_handler(Exception)
async def validation_exception_handler(request: Request, exc: Exception):
    error_msg = f"Unhandled Error: {exc}\n{traceback.format_exc()}"
    logging.error(error_msg)
    print(error_msg, file=sys.stderr) # Ensure it prints to console too
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Check logs."},
    )

from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Debug 404: Route not found for {request.method} {request.url.path}"},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Welcome to the AI Career Platform API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
