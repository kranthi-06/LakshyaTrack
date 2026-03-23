"""
LakshyaTrack API — Production-grade FastAPI application with:
- Comprehensive global error handling
- Request timing and slow-request detection
- Rate limiting middleware
- System health monitoring endpoints
- Graceful shutdown and startup (modern lifespan protocol)
- Module isolation (failures contained per-request)
- Connection pool pre-warming for zero cold-start latency
"""
import logging
import os
import sys
import time
import traceback
import uuid
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.api import api_router
from app.api.deps import require_admin
from app.core.config import settings
from app.core.logging_utils import configure_logging_json
from app.core.idempotency import build_idempotency_storage_key
from app.core.request_context import set_request_id
from app.core.resilience import (
    allow_rate_limit,
    health_metrics,
    safe_execute,
)
from app.db.base_class import Base
from app.db.mongodb import close_mongodb, init_mongodb
from app.db.session import check_db_health, engine
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
from app.models.reasoning import ReasoningQuestion, ReasoningTest, ReasoningUserProgress
from app.models.user import Blacklist, Profile, User
from app.models.subscription import (
    SubscriptionPlan, MicroPlan, UserSubscription,
    UserMicroPurchase, Coupon, CouponUsage, PaymentTransaction,
)
from app.models.usage import UserUsage
from app.services import document_store_service

# Configure structured logging early so startup failures appear in logs.
# This does not affect API behavior—only log format and request correlation.
configure_logging_json(level=logging.INFO)
logger = logging.getLogger(__name__)

_background_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan handler — replaces deprecated on_event('startup'/'shutdown')."""
    global _background_scheduler
    logger.info("=== LakshyaTrack API Starting ===")

    # ── Startup ────────────────────────────────────────────────

    # 1. Initialize relational database + pre-warm connection pool
    try:
        initialize_relational_database()
        logger.info("PostgreSQL: OK")

        # Pre-warm pool so first real requests don't suffer cold-start latency
        try:
            from app.db.session import prewarm_pool
            prewarm_pool(min_connections=3)
        except Exception:
            logger.warning("Pool pre-warm failed (non-fatal).")

        # Seed default subscription plans
        try:
            from app.services.subscription_service import seed_default_plans
            from app.db.session import SessionLocal
            seed_db = SessionLocal()
            try:
                seed_default_plans(seed_db)
            finally:
                seed_db.close()
            logger.info("Subscription plans: seeded")
        except Exception:
            logger.exception("Subscription plan seeding failed (non-fatal).")
    except Exception:
        logger.exception("Relational DB startup failed (non-fatal).")

    # 2. Initialize MongoDB
    try:
        init_mongodb()
        logger.info("MongoDB: OK")
    except Exception:
        logger.exception("MongoDB startup failed (non-fatal).")

    # 3. Background scheduler (skip in Vercel serverless)
    if not _is_vercel_runtime():
        try:
            from app.core.background_jobs import setup_background_jobs
            _background_scheduler = setup_background_jobs()
            logger.info("Background scheduler: OK")
        except Exception:
            logger.exception("Background scheduler failed to start.")
    else:
        logger.info("Skipping background scheduler in Vercel serverless runtime.")

    logger.info("=== LakshyaTrack API Ready ===")

    yield  # ── Application runs here ──

    # ── Shutdown ───────────────────────────────────────────────
    logger.info("=== LakshyaTrack API Shutting Down ===")

    # Gracefully stop background scheduler
    if _background_scheduler is not None:
        try:
            _background_scheduler.shutdown(wait=False)
            logger.info("Background scheduler stopped.")
        except Exception:
            pass

    # Close MongoDB
    try:
        close_mongodb()
    except Exception:
        pass

    logger.info("=== LakshyaTrack API Shutdown Complete ===")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Lock-free caches — use monotonic timestamps for expiration.
# asyncio.Lock was causing serialization bottleneck under load.
_HEALTH_CACHE: dict = {"expires_at": 0.0, "payload": None}
_HEALTH_REFRESHING = False  # Simple flag to prevent thundering herd
_READY_CACHE: dict = {"expires_at": 0.0, "payload": None, "status_code": 200}
_READY_REFRESHING = False

# Ultra-fast endpoints that should skip heavy middleware processing
_FAST_PATHS = frozenset({"/", "/health/live", "/docs", "/redoc", "/openapi.json"})


def _is_vercel_runtime() -> bool:
    return os.getenv("VERCEL") == "1"


def _ensure_column(conn, inspector, table_name: str, column_name: str, ddl: str) -> None:
    try:
        existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
        if column_name not in existing_cols:
            conn.execute(text(ddl))
            conn.commit()
    except Exception as e:
        logger.warning("Failed to ensure column %s.%s: %s", table_name, column_name, str(e))


def initialize_relational_database() -> None:
    """Run best-effort SQL startup tasks without crashing app import."""
    try:
        Base.metadata.create_all(bind=engine)

        with engine.connect() as conn:
            inspector = inspect(conn)
            table_names = set(inspector.get_table_names())

            if "users" in table_names:
                _ensure_column(conn, inspector, "users", "hashed_password",
                               "ALTER TABLE users ADD COLUMN hashed_password VARCHAR")
                _ensure_column(conn, inspector, "users", "is_verified",
                               "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT TRUE NOT NULL")
                _ensure_column(conn, inspector, "users", "role",
                               "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL")
                _ensure_column(conn, inspector, "users", "is_blacklisted",
                               "ALTER TABLE users ADD COLUMN is_blacklisted BOOLEAN DEFAULT FALSE NOT NULL")
                _ensure_column(conn, inspector, "users", "last_active_at",
                               "ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ")
                try:
                    conn.execute(text(
                        "UPDATE users "
                        "SET role = COALESCE(role, 'user'), "
                        "    is_blacklisted = COALESCE(is_blacklisted, FALSE), "
                        "    is_verified = COALESCE(is_verified, TRUE)"
                    ))
                    conn.commit()
                except Exception:
                    conn.rollback()

            if "profiles" in table_names:
                _ensure_column(conn, inspector, "profiles", "profile_photo_url",
                               "ALTER TABLE profiles ADD COLUMN profile_photo_url VARCHAR")
                _ensure_column(conn, inspector, "profiles", "profile_image_url",
                               "ALTER TABLE profiles ADD COLUMN profile_image_url VARCHAR")
                _ensure_column(conn, inspector, "profiles", "resume_url",
                               "ALTER TABLE profiles ADD COLUMN resume_url VARCHAR")
                _ensure_column(conn, inspector, "profiles", "certificate_url",
                               "ALTER TABLE profiles ADD COLUMN certificate_url VARCHAR")
                _ensure_column(conn, inspector, "profiles", "project_image_url",
                               "ALTER TABLE profiles ADD COLUMN project_image_url VARCHAR")
                _ensure_column(conn, inspector, "profiles", "links",
                               "ALTER TABLE profiles ADD COLUMN links JSONB DEFAULT '{}'::jsonb")
                _ensure_column(conn, inspector, "profiles", "skills",
                               "ALTER TABLE profiles ADD COLUMN skills JSONB DEFAULT '[]'::jsonb")
                _ensure_column(conn, inspector, "profiles", "activity_log",
                               "ALTER TABLE profiles ADD COLUMN activity_log JSONB DEFAULT '[]'::jsonb")
                _ensure_column(conn, inspector, "profiles", "role",
                               "ALTER TABLE profiles ADD COLUMN role VARCHAR DEFAULT 'user'")
                _ensure_column(conn, inspector, "profiles", "is_blacklisted",
                               "ALTER TABLE profiles ADD COLUMN is_blacklisted BOOLEAN DEFAULT FALSE")
                _ensure_column(conn, inspector, "profiles", "last_active_at",
                               "ALTER TABLE profiles ADD COLUMN last_active_at TIMESTAMPTZ")
                try:
                    if "users" in table_names:
                        conn.execute(text(
                            "INSERT INTO profiles (id, full_name) "
                            "SELECT u.id, split_part(u.email, '@', 1) "
                            "FROM users u "
                            "LEFT JOIN profiles p ON p.id = u.id "
                            "WHERE p.id IS NULL"
                        ))
                        conn.execute(text(
                            "UPDATE profiles p "
                            "SET full_name = split_part(u.email, '@', 1) "
                            "FROM users u "
                            "WHERE p.id = u.id AND (p.full_name IS NULL OR BTRIM(p.full_name) = '')"
                        ))
                        conn.execute(text(
                            "UPDATE profiles p "
                            "SET role = COALESCE(p.role, u.role, 'user'), "
                            "    is_blacklisted = COALESCE(p.is_blacklisted, u.is_blacklisted, FALSE), "
                            "    last_active_at = COALESCE(p.last_active_at, u.last_active_at) "
                            "FROM users u "
                            "WHERE p.id = u.id"
                        ))
                    conn.execute(text(
                        "UPDATE profiles "
                        "SET profile_image_url = COALESCE(profile_image_url, profile_photo_url), "
                        "    profile_photo_url = COALESCE(profile_photo_url, profile_image_url)"
                    ))
                    conn.commit()
                except Exception:
                    conn.rollback()

            if "saved_resumes" in table_names:
                _ensure_column(conn, inspector, "saved_resumes", "resume_url",
                               "ALTER TABLE saved_resumes ADD COLUMN resume_url VARCHAR")
                _ensure_column(conn, inspector, "saved_resumes", "target_role",
                               "ALTER TABLE saved_resumes ADD COLUMN target_role VARCHAR")
                _ensure_column(conn, inspector, "saved_resumes", "ats_score",
                               "ALTER TABLE saved_resumes ADD COLUMN ats_score DOUBLE PRECISION")
                _ensure_column(conn, inspector, "saved_resumes", "is_primary",
                               "ALTER TABLE saved_resumes ADD COLUMN is_primary BOOLEAN DEFAULT FALSE")

            if "roadmaps" in table_names:
                _ensure_column(conn, inspector, "roadmaps", "topic_name",
                               "ALTER TABLE roadmaps ADD COLUMN topic_name VARCHAR")
                _ensure_column(conn, inspector, "roadmaps", "last_opened",
                               "ALTER TABLE roadmaps ADD COLUMN last_opened TIMESTAMPTZ DEFAULT NOW()")

            if "opportunities" in table_names:
                _ensure_column(conn, inspector, "opportunities", "category",
                               "ALTER TABLE opportunities ADD COLUMN category VARCHAR")
                _ensure_column(conn, inspector, "opportunities", "provider",
                               "ALTER TABLE opportunities ADD COLUMN provider VARCHAR")

            if "quiz_attempts" in table_names:
                _ensure_column(conn, inspector, "quiz_attempts", "violation_flag",
                               "ALTER TABLE quiz_attempts ADD COLUMN violation_flag BOOLEAN DEFAULT FALSE")
                _ensure_column(conn, inspector, "quiz_attempts", "terminated",
                               "ALTER TABLE quiz_attempts ADD COLUMN terminated BOOLEAN DEFAULT FALSE")

        logger.info("Relational database startup checks completed.")
    except Exception:
        logger.exception(
            "Relational database startup checks failed. API will stay up."
        )


# ── CORS configuration ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression for larger responses
app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Lifecycle managed by lifespan() context manager above ─────


# ── ASGI timing + rate limiting middleware ─────────────────────

class RequestProtectionMiddleware:
    """
    Production ASGI middleware:
    - Request timing with X-Response-Time header
    - Slow request detection and logging
    - Global rate limiting per IP
    - Request size protection
    """

    SLOW_REQUEST_THRESHOLD_MS = 2000
    MAX_REQUEST_BODY_BYTES = 50 * 1024 * 1024  # 50MB

    def __init__(self, app):
        self.app = app

    @staticmethod
    def _extract_client_ip(scope) -> str:
        headers = {k.lower(): v for (k, v) in (scope.get("headers") or [])}
        xff = headers.get(b"x-forwarded-for")
        if xff:
            try:
                return xff.decode("utf-8").split(",")[0].strip() or "unknown"
            except Exception:
                return "unknown"
        client = scope.get("client")
        if client and len(client) > 0:
            return str(client[0])
        return "unknown"

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")
        start = time.perf_counter()
        request_id = None
        for (k, v) in scope.get("headers", []):
            if k == b"x-request-id":
                try:
                    request_id = v.decode("utf-8")
                except Exception:
                    request_id = None
                break
        if not request_id:
            request_id = str(uuid.uuid4())
        set_request_id(request_id)

        # Fast-path: skip rate limiting + heavy metric tracking for lightweight endpoints
        is_fast_path = path in _FAST_PATHS

        # Rate limiting (skip low-cost infra endpoints)
        if (
            settings.RATE_LIMIT_ENABLED
            and not is_fast_path
            and path != "/health"
        ):
            client_ip = self._extract_client_ip(scope)
            global_allowed = await allow_rate_limit(
                name="global",
                max_calls=settings.RATE_LIMIT_GLOBAL_PER_MINUTE,
                window_seconds=60,
                backend=settings.RATE_LIMIT_BACKEND,
                redis_url=settings.REDIS_URL,
            )
            ip_allowed = await allow_rate_limit(
                name=f"ip:{client_ip}",
                max_calls=settings.RATE_LIMIT_IP_PER_MINUTE,
                window_seconds=60,
                backend=settings.RATE_LIMIT_BACKEND,
                redis_url=settings.REDIS_URL,
            )
            if not global_allowed or not ip_allowed:
                response = JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please slow down."},
                )
                await response(scope, receive, send)
                return

        # Pre-compute request ID bytes once
        request_id_bytes = request_id.encode()

        async def timed_send(message):
            if message["type"] == "http.response.start":
                duration_ms = (time.perf_counter() - start) * 1000
                headers = list(message.get("headers", []))
                headers.append(
                    (b"x-response-time", f"{duration_ms:.1f}ms".encode())
                )
                headers.append((b"x-request-id", request_id_bytes))
                message = {**message, "headers": headers}

                # Only record metrics for non-fast-path endpoints (skip for / and /health/live)
                if not is_fast_path:
                    status_code = message.get("status", 200)
                    success = 200 <= status_code < 500
                    parts = path.split("/")
                    module = parts[3] if len(parts) > 3 else "root"
                    health_metrics.record_request(module, duration_ms, success)

                    # Slow request warning
                    if duration_ms > self.SLOW_REQUEST_THRESHOLD_MS:
                        logger.warning(
                            "SLOW REQUEST [%s]: %s %s took %.0fms (status %d)",
                            request_id, method, path, duration_ms,
                            message.get("status", 200),
                        )
            await send(message)

        try:
            await self.app(scope, receive, timed_send)
        except Exception as e:
            duration_ms = (time.perf_counter() - start) * 1000
            if not is_fast_path:
                health_metrics.record_request("unhandled", duration_ms, success=False)
            logger.error("Unhandled middleware exception [%s] on %s %s: %s", request_id, method, path, str(e))
            # Return 500 instead of crashing
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )
            await response(scope, receive, send)
        finally:
            set_request_id(None)


app.add_middleware(RequestProtectionMiddleware)

class IdempotencyMiddleware:
    """
    Opt-in idempotency for write requests.
    - Only active when request includes `Idempotency-Key` header.
    - Uses MongoDB Atlas if configured; otherwise no-ops.
    - Replays stored response for the same key+request fingerprint.
    """

    IDEMPOTENCY_HEADER = b"idempotency-key"

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = (scope.get("method") or "").upper()
        if method not in ("POST", "PUT", "PATCH", "DELETE"):
            await self.app(scope, receive, send)
            return

        headers = {k.lower(): v for (k, v) in (scope.get("headers") or [])}
        idem_raw = headers.get(self.IDEMPOTENCY_HEADER)
        if not idem_raw:
            await self.app(scope, receive, send)
            return

        try:
            idempotency_key = idem_raw.decode("utf-8").strip()[:200]
        except Exception:
            await self.app(scope, receive, send)
            return

        # Read and buffer full request body so we can fingerprint it and still pass it downstream.
        body_chunks = []
        more_body = True

        async def buffered_receive():
            return await receive()

        while more_body:
            message = await buffered_receive()
            if message["type"] != "http.request":
                continue
            chunk = message.get("body", b"")
            if chunk:
                body_chunks.append(chunk)
            more_body = message.get("more_body", False)

        body_bytes = b"".join(body_chunks)

        # Re-create a receive() that replays the buffered body to downstream app.
        replayed = False

        async def replay_receive():
            nonlocal replayed
            if replayed:
                return {"type": "http.request", "body": b"", "more_body": False}
            replayed = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        path = scope.get("path", "")
        authorization = None
        auth_raw = headers.get(b"authorization")
        if auth_raw:
            try:
                authorization = auth_raw.decode("utf-8")
            except Exception:
                authorization = None

        idem_key, request_hash = build_idempotency_storage_key(
            method=method,
            path=path,
            idempotency_key=idempotency_key,
            authorization_header=authorization,
            body_bytes=body_bytes,
        )

        existing = document_store_service.get_idempotency_record(idem_key)
        if existing and existing.get("request_hash") == request_hash:
            try:
                import base64

                resp_body = base64.b64decode(existing.get("response_body_b64") or "")
                content_type = existing.get("content_type") or "application/json"
                status_code = int(existing.get("status_code") or 200)
                await send(
                    {
                        "type": "http.response.start",
                        "status": status_code,
                        "headers": [
                            (b"content-type", content_type.encode("utf-8")),
                            (b"x-idempotent-replay", b"1"),
                        ],
                    }
                )
                await send(
                    {
                        "type": "http.response.body",
                        "body": resp_body,
                        "more_body": False,
                    }
                )
                return
            except Exception:
                # If replay fails, fall through to normal execution
                pass

        # Capture downstream response to store for replay
        response_start = None
        response_body = bytearray()

        async def capturing_send(message):
            nonlocal response_start, response_body
            if message["type"] == "http.response.start":
                response_start = message
            elif message["type"] == "http.response.body":
                chunk = message.get("body", b"")
                if chunk and len(response_body) <= settings.IDEMPOTENCY_MAX_RESPONSE_BYTES:
                    response_body.extend(chunk)
            await send(message)

        await self.app(scope, replay_receive, capturing_send)

        # Store only if we captured a complete, bounded response and have MongoDB available.
        try:
            if response_start and len(response_body) <= settings.IDEMPOTENCY_MAX_RESPONSE_BYTES:
                status_code = int(response_start.get("status", 200))
                # Avoid caching server errors; they should be retried/fixed, not replayed.
                if status_code < 500:
                    headers_list = response_start.get("headers", []) or []
                    content_type = "application/json"
                    for (k, v) in headers_list:
                        if k.lower() == b"content-type":
                            try:
                                content_type = v.decode("utf-8")
                            except Exception:
                                pass
                            break
                    document_store_service.set_idempotency_record(
                        idem_key=idem_key,
                        method=method,
                        path=path,
                        request_hash=request_hash,
                        status_code=status_code,
                        response_body=bytes(response_body),
                        response_content_type=content_type,
                        response_headers=None,
                    )
        except Exception:
            pass


app.add_middleware(IdempotencyMiddleware)


# ── Global exception handlers ─────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler — the system NEVER crashes from unhandled exceptions."""
    error_id = f"ERR-{int(time.time())}"
    error_msg = f"[{error_id}] {type(exc).__name__}: {str(exc)}"

    # Log full traceback for debugging
    logger.error(
        "Unhandled exception [%s] %s %s: %s\n%s",
        error_id,
        request.method,
        request.url.path,
        str(exc),
        traceback.format_exc(),
    )

    # Return safe response (no internal details leaked in production)
    is_vercel = _is_vercel_runtime()
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error_id": error_id,
            # Only include details in non-production environments
            "error": error_msg if not is_vercel else None,
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Route not found: {request.method} {request.url.path}"},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


# ── Routes ─────────────────────────────────────────────────────

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Welcome to the AI Career Platform API", "status": "operational"}


@app.get("/health")
async def health_check():
    """
    Comprehensive health check — verifies all subsystems.
    Uses lock-free caching to prevent serialization bottleneck under load.
    DB check runs in a thread pool to avoid blocking the async event loop.
    """
    global _HEALTH_REFRESHING
    from app.db.mongodb import get_mongodb
    from app.services.ai_service import ai_hub

    now = time.monotonic()
    cached_payload = _HEALTH_CACHE.get("payload")
    expires_at = float(_HEALTH_CACHE.get("expires_at", 0.0))

    # Fast path: return cached payload if still valid
    if cached_payload is not None and now < expires_at:
        return cached_payload

    # Prevent thundering herd: only one coroutine refreshes at a time.
    # Others get the stale (but valid) cached response instead of blocking.
    if _HEALTH_REFRESHING:
        if cached_payload is not None:
            return cached_payload
        return {"status": "starting", "database": {"status": "checking"}}

    _HEALTH_REFRESHING = True
    try:
        # Run synchronous DB health check in thread pool to avoid blocking event loop
        db_status = await asyncio.to_thread(check_db_health)
        mongo_status = "connected" if get_mongodb() is not None else "disconnected"

        overall = "healthy"
        if db_status.get("status") != "healthy":
            overall = "degraded"
        if db_status.get("status") == "unhealthy" and mongo_status == "disconnected":
            overall = "critical"

        payload = {
            "status": overall,
            "database": db_status,
            "mongodb": {"status": mongo_status},
            "ai_providers": ai_hub.get_provider_status(),
            "system_metrics": health_metrics.get_summary(),
        }
        ttl_seconds = max(1, int(settings.HEALTH_CACHE_TTL_SECONDS))
        _HEALTH_CACHE["payload"] = payload
        _HEALTH_CACHE["expires_at"] = time.monotonic() + ttl_seconds
        return payload
    except Exception as e:
        logger.warning("Health check refresh failed: %s", str(e))
        if cached_payload is not None:
            return cached_payload
        return {"status": "degraded", "error": "health check temporarily unavailable"}
    finally:
        _HEALTH_REFRESHING = False


@app.get("/health/live")
async def health_live():
    """
    Ultra-light liveness endpoint.
    Does not touch DB/network dependencies and is safe under very high QPS.
    """
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready():
    """
    Readiness endpoint for load balancers/orchestrators.
    Returns 200 when critical dependencies are ready, 503 otherwise.
    Lock-free with thundering-herd protection.
    """
    global _READY_REFRESHING
    now = time.monotonic()
    cached_payload = _READY_CACHE.get("payload")
    cached_status = int(_READY_CACHE.get("status_code", 200))
    if cached_payload is not None and now < float(_READY_CACHE.get("expires_at", 0.0)):
        return JSONResponse(status_code=cached_status, content=cached_payload)

    if _READY_REFRESHING:
        if cached_payload is not None:
            return JSONResponse(status_code=cached_status, content=cached_payload)
        return JSONResponse(status_code=200, content={"status": "checking"})

    _READY_REFRESHING = True
    try:
        db_status = await asyncio.to_thread(check_db_health)
        db_healthy = db_status.get("status") == "healthy"
        status_code = 200 if db_healthy else 503
        payload = {
            "status": "ready" if db_healthy else "not_ready",
            "database": {"status": db_status.get("status", "unknown")},
        }

        ttl_seconds = max(1, min(int(settings.HEALTH_CACHE_TTL_SECONDS), 10))
        _READY_CACHE["payload"] = payload
        _READY_CACHE["status_code"] = status_code
        _READY_CACHE["expires_at"] = time.monotonic() + ttl_seconds
        return JSONResponse(status_code=status_code, content=payload)
    except Exception as e:
        logger.warning("Ready check failed: %s", str(e))
        if cached_payload is not None:
            return JSONResponse(status_code=cached_status, content=cached_payload)
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    finally:
        _READY_REFRESHING = False


@app.get("/health/detailed")
async def detailed_health(_: User = Depends(require_admin)):
    """
    Detailed system health with all metrics, circuit breakers, and module status.
    For admin/monitoring use.
    """
    from app.services.ai_service import ai_hub

    return {
        "system_metrics": health_metrics.get_summary(),
        "ai_providers": ai_hub.get_provider_status(),
        "database": check_db_health(),
    }
