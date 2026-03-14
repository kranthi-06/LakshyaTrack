import logging
import os
import sys
import time
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from starlette.exceptions import HTTPException as StarletteHTTPException


from app.api.api import api_router
from app.core.config import settings
from app.db.base_class import Base
from app.db.mongodb import close_mongodb, init_mongodb
from app.db.session import engine
from app.models.career import (
    InterviewSession,
    LearningCache,
    MultiStageInterview,
    Opportunity,
    ProgressSnapshot,
    QuizAttempt,
    Roadmap,
)
from app.models.resume import SavedResume
from app.models.user import Blacklist, Profile, User

# Configure logging early so startup failures appear in Vercel logs.
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)


def _is_vercel_runtime() -> bool:
    return os.getenv("VERCEL") == "1"


def _ensure_column(conn, inspector, table_name: str, column_name: str, ddl: str) -> None:
    existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
    if column_name not in existing_cols:
        conn.execute(text(ddl))
        conn.commit()


def initialize_relational_database() -> None:
    """Run best-effort SQL startup tasks without crashing app import."""
    try:
        Base.metadata.create_all(bind=engine)

        with engine.connect() as conn:
            inspector = inspect(conn)
            table_names = set(inspector.get_table_names())

            if "users" in table_names:
                _ensure_column(
                    conn,
                    inspector,
                    "users",
                    "hashed_password",
                    "ALTER TABLE users ADD COLUMN hashed_password VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "users",
                    "is_verified",
                    "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT TRUE NOT NULL",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "users",
                    "role",
                    "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "users",
                    "is_blacklisted",
                    "ALTER TABLE users ADD COLUMN is_blacklisted BOOLEAN DEFAULT FALSE NOT NULL",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "users",
                    "last_active_at",
                    "ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ",
                )
                conn.execute(
                    text(
                        "UPDATE users "
                        "SET role = COALESCE(role, 'user'), "
                        "    is_blacklisted = COALESCE(is_blacklisted, FALSE), "
                        "    is_verified = COALESCE(is_verified, TRUE)"
                    )
                )
                conn.commit()

            if "profiles" in table_names:
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "profile_photo_url",
                    "ALTER TABLE profiles ADD COLUMN profile_photo_url VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "profile_image_url",
                    "ALTER TABLE profiles ADD COLUMN profile_image_url VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "resume_url",
                    "ALTER TABLE profiles ADD COLUMN resume_url VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "certificate_url",
                    "ALTER TABLE profiles ADD COLUMN certificate_url VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "project_image_url",
                    "ALTER TABLE profiles ADD COLUMN project_image_url VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "links",
                    "ALTER TABLE profiles ADD COLUMN links JSONB DEFAULT '{}'::jsonb",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "skills",
                    "ALTER TABLE profiles ADD COLUMN skills JSONB DEFAULT '[]'::jsonb",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "activity_log",
                    "ALTER TABLE profiles ADD COLUMN activity_log JSONB DEFAULT '[]'::jsonb",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "role",
                    "ALTER TABLE profiles ADD COLUMN role VARCHAR DEFAULT 'user'",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "is_blacklisted",
                    "ALTER TABLE profiles ADD COLUMN is_blacklisted BOOLEAN DEFAULT FALSE",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "profiles",
                    "last_active_at",
                    "ALTER TABLE profiles ADD COLUMN last_active_at TIMESTAMPTZ",
                )
                if "users" in table_names:
                    conn.execute(
                        text(
                            "INSERT INTO profiles (id, full_name) "
                            "SELECT u.id, split_part(u.email, '@', 1) "
                            "FROM users u "
                            "LEFT JOIN profiles p ON p.id = u.id "
                            "WHERE p.id IS NULL"
                        )
                    )
                    conn.execute(
                        text(
                            "UPDATE profiles p "
                            "SET full_name = split_part(u.email, '@', 1) "
                            "FROM users u "
                            "WHERE p.id = u.id AND (p.full_name IS NULL OR BTRIM(p.full_name) = '')"
                        )
                    )
                    conn.execute(
                        text(
                            "UPDATE profiles p "
                            "SET role = COALESCE(p.role, u.role, 'user'), "
                            "    is_blacklisted = COALESCE(p.is_blacklisted, u.is_blacklisted, FALSE), "
                            "    last_active_at = COALESCE(p.last_active_at, u.last_active_at) "
                            "FROM users u "
                            "WHERE p.id = u.id"
                        )
                    )
                conn.execute(
                    text(
                        "UPDATE profiles "
                        "SET profile_image_url = COALESCE(profile_image_url, profile_photo_url), "
                        "    profile_photo_url = COALESCE(profile_photo_url, profile_image_url)"
                    )
                )
                conn.commit()

            if "saved_resumes" in table_names:
                _ensure_column(
                    conn,
                    inspector,
                    "saved_resumes",
                    "resume_url",
                    "ALTER TABLE saved_resumes ADD COLUMN resume_url VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "saved_resumes",
                    "target_role",
                    "ALTER TABLE saved_resumes ADD COLUMN target_role VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "saved_resumes",
                    "ats_score",
                    "ALTER TABLE saved_resumes ADD COLUMN ats_score DOUBLE PRECISION",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "saved_resumes",
                    "is_primary",
                    "ALTER TABLE saved_resumes ADD COLUMN is_primary BOOLEAN DEFAULT FALSE",
                )

            if "roadmaps" in table_names:
                _ensure_column(
                    conn,
                    inspector,
                    "roadmaps",
                    "topic_name",
                    "ALTER TABLE roadmaps ADD COLUMN topic_name VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "roadmaps",
                    "last_opened",
                    "ALTER TABLE roadmaps ADD COLUMN last_opened TIMESTAMPTZ DEFAULT NOW()",
                )

            if "opportunities" in table_names:
                _ensure_column(
                    conn,
                    inspector,
                    "opportunities",
                    "category",
                    "ALTER TABLE opportunities ADD COLUMN category VARCHAR",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "opportunities",
                    "provider",
                    "ALTER TABLE opportunities ADD COLUMN provider VARCHAR",
                )

            if "quiz_attempts" in table_names:
                _ensure_column(
                    conn,
                    inspector,
                    "quiz_attempts",
                    "violation_flag",
                    "ALTER TABLE quiz_attempts ADD COLUMN violation_flag BOOLEAN DEFAULT FALSE",
                )
                _ensure_column(
                    conn,
                    inspector,
                    "quiz_attempts",
                    "terminated",
                    "ALTER TABLE quiz_attempts ADD COLUMN terminated BOOLEAN DEFAULT FALSE",
                )

        logger.info("Relational database startup checks completed.")
    except Exception:
        logger.exception(
            "Relational database startup checks failed. The API will stay up, but database-backed routes may still fail until DATABASE_URL/schema issues are fixed."
        )


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression for larger responses
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.on_event("startup")
async def startup_event():
    try:
        initialize_relational_database()
    except Exception:
        logger.exception("Relational DB startup failed (non-fatal).")
    try:
        init_mongodb()
    except Exception:
        logger.exception("MongoDB startup failed (non-fatal).")

    if _is_vercel_runtime():
        logger.info("Skipping background scheduler in Vercel serverless runtime.")
        return

    try:
        from app.core.background_jobs import setup_background_jobs

        setup_background_jobs()
    except Exception:
        logger.exception("Background scheduler failed to start.")


@app.on_event("shutdown")
async def shutdown_event():
    close_mongodb()


# ── Pure ASGI timing middleware (replaces BaseHTTPMiddleware to avoid
#    Vercel serverless streaming / response corruption issues) ──────────

class RequestTimingMiddleware:
    """Lightweight ASGI middleware that adds X-Response-Time without
    buffering or interfering with the response stream."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()

        async def timed_send(message):
            if message["type"] == "http.response.start":
                duration_ms = (time.perf_counter() - start) * 1000
                headers = list(message.get("headers", []))
                headers.append(
                    (b"x-response-time", f"{duration_ms:.1f}ms".encode())
                )
                message = {**message, "headers": headers}

                # Extract path for slow-request logging
                path = scope.get("path", "")
                method = scope.get("method", "")
                if duration_ms > 1000:
                    logger.warning(
                        "SLOW REQUEST: %s %s took %.0fms",
                        method, path, duration_ms,
                    )
            await send(message)

        await self.app(scope, receive, timed_send)


app.add_middleware(RequestTimingMiddleware)


@app.exception_handler(Exception)
async def validation_exception_handler(request: Request, exc: Exception):
    error_msg = f"Unhandled Error: {exc}\n{traceback.format_exc()}"
    logging.error(error_msg)
    print(error_msg, file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Check logs.", "error": error_msg},
    )


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
