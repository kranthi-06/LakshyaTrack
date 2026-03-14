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
from starlette.middleware.base import BaseHTTPMiddleware

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
from app.models.user import User

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
    initialize_relational_database()
    init_mongodb()

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


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
        if duration_ms > 1000:
            logger.warning(
                "SLOW REQUEST: %s %s took %.0fms",
                request.method,
                request.url.path,
                duration_ms,
            )
        return response


app.add_middleware(RequestTimingMiddleware)


@app.exception_handler(Exception)
async def validation_exception_handler(request: Request, exc: Exception):
    error_msg = f"Unhandled Error: {exc}\n{traceback.format_exc()}"
    logging.error(error_msg)
    print(error_msg, file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Check logs."},
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
