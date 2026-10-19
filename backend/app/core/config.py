import base64
import json
import os
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Career Platform"
    API_V1_STR: str = "/api/v1"
    # Environment
    # - development: permissive defaults for local runs
    # - production: require explicit env vars for secrets/DB
    APP_ENV: str = "development"
    SANDBOX_ALLOW_UNSAFE_FALLBACK: bool = False
    PAYMENTS_DEMO_MODE: bool = False
    # API docs expose the full route/schema inventory. They are disabled in
    # production unless an operator explicitly opts in.
    ENABLE_API_DOCS: bool = False
    
    # Database
    # Set DATABASE_URL via environment variable or .env file.
    # For local development, defaults to SQLite. In production, must be PostgreSQL.
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "ai_career_platform"
    
    # API Access (for Auth/Storage if needed)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    
    # Security
    # No insecure default. Must be explicitly configured via env var.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # External APIs
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    YOUTUBE_API_KEY: str = ""
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: str = ""
    GOOGLE_CLIENT_ID: str = ""  # For Google OAuth audience validation (required in production)
    
    # Email
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@example.com"
    
    # Admin System
    BLACK_ADMIN_EMAILS: str = ""  # Comma-separated emails for permanent super-admin access
    # CORS: explicit authorized origins only. Never use a wildcard with credentials.
    # Local development defaults to the Vite dev server origin. Production MUST set
    # CORS_ORIGINS to the exact frontend origin(s) via environment variable.
    CORS_ORIGINS: str = "http://localhost:5173"

    # AI caching (MongoDB Atlas)
    AI_CACHE_TTL_SECONDS: int = 60 * 60 * 24 * 7  # 7 days

    # Idempotency (MongoDB Atlas)
    IDEMPOTENCY_TTL_SECONDS: int = 60 * 60 * 24  # 24 hours
    IDEMPOTENCY_MAX_RESPONSE_BYTES: int = 1024 * 1024  # 1MB

    # Request protection and load tuning
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_BACKEND: str = "auto"  # auto | memory | redis
    RATE_LIMIT_GLOBAL_PER_MINUTE: int = 12000
    RATE_LIMIT_IP_PER_MINUTE: int = 2400
    # Authentication endpoints get a much smaller per-IP budget.
    AUTH_RATE_LIMIT_PER_MINUTE: int = 30
    # Only trust X-Forwarded-For when the app is known to sit behind a proxy
    # that overwrites/appends the header (Vercel does; a bare ASGI deployment
    # does not).
    TRUST_PROXY_HEADERS: bool = False
    MAX_REQUEST_BODY_BYTES: int = 50 * 1024 * 1024
    REDIS_URL: str = ""

    # Health endpoint optimization
    HEALTH_CACHE_TTL_SECONDS: int = 10

    # Async job queue backend
    JOB_QUEUE_BACKEND: str = "auto"  # auto | memory | redis
    JOB_QUEUE_TTL_SECONDS: int = 60 * 60  # 1 hour
    JOB_QUEUE_REDIS_LIST_KEY: str = "jobs:queue"

    # SQLAlchemy pool tuning (PostgreSQL)
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_POOL_RECYCLE_SECONDS: int = 1800
    
    class Config:
        env_file = Path(__file__).resolve().parents[2] / ".env"

    @field_validator("APP_ENV")
    @classmethod
    def _normalize_app_env(cls, value: str) -> str:
        return (value or "development").strip().lower()

    @field_validator("ALGORITHM")
    @classmethod
    def _normalize_algorithm(cls, value: str) -> str:
        return (value or "HS256").strip().upper()

    def get_cors_origins(self) -> list[str]:
        raw = (self.CORS_ORIGINS or "").strip()
        if raw == "*":
            return ["*"]
        return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]

    def validate_production_safety(self) -> None:
        """Fail closed on insecure production configuration.

        Runs once at import time.  Development keeps permissive defaults so the
        local SQLite workflow is unchanged.
        """
        if self.ALGORITHM not in _ALLOWED_JWT_ALGORITHMS:
            raise RuntimeError(
                f"ALGORITHM must be one of {sorted(_ALLOWED_JWT_ALGORITHMS)}."
            )

        if self.APP_ENV != "production":
            return

        secret = (self.SECRET_KEY or "").strip()
        lowered_secret = secret.lower()
        if (
            len(secret) < _MIN_SECRET_KEY_LENGTH
            or lowered_secret in _PLACEHOLDER_SECRET_KEYS
            or any(marker in lowered_secret for marker in _PLACEHOLDER_SECRET_MARKERS)
        ):
            raise RuntimeError(
                "SECRET_KEY must be an explicitly configured random secret of at "
                f"least {_MIN_SECRET_KEY_LENGTH} characters in production."
            )

        database_url = (self.DATABASE_URL or "").strip().lower()
        if (
            not database_url.startswith(("postgresql://", "postgres://", "postgresql+"))
            or "sqlite" in database_url
        ):
            raise RuntimeError(
                "DATABASE_URL must be a PostgreSQL connection URL in production."
            )
        if any(marker in database_url for marker in _UNCONFIGURED_DB_MARKERS):
            raise RuntimeError(
                "DATABASE_URL still contains placeholder credentials in production."
            )

        if self.PAYMENTS_DEMO_MODE:
            raise RuntimeError(
                "PAYMENTS_DEMO_MODE must be false in production; demo payments "
                "must never activate entitlements outside development."
            )

        google_client_id = (self.GOOGLE_CLIENT_ID or "").strip()
        if not google_client_id or not google_client_id.endswith(
            ".apps.googleusercontent.com"
        ):
            raise RuntimeError(
                "GOOGLE_CLIENT_ID must be set to the Google OAuth web client ID "
                "in production."
            )

        supabase_url = (self.SUPABASE_URL or "").strip()
        if not supabase_url.startswith("https://") or "your-project" in supabase_url.lower():
            raise RuntimeError(
                "SUPABASE_URL must be the project's https URL in production."
            )
        supabase_key = (self.SUPABASE_KEY or "").strip()
        if not supabase_key:
            raise RuntimeError("SUPABASE_KEY must be configured in production.")
        if _is_service_role_key(supabase_key):
            raise RuntimeError(
                "SUPABASE_KEY must not be a service-role/secret key. The backend "
                "auth verification path only needs the project's public API key."
            )

        mongo_uri = (self.MONGODB_URI or "").strip()
        if not mongo_uri.startswith(("mongodb://", "mongodb+srv://")):
            raise RuntimeError(
                "MONGODB_URI must be a mongodb:// or mongodb+srv:// URL in production."
            )

        origins = self.get_cors_origins()
        if not origins or "*" in origins:
            raise RuntimeError(
                "CORS_ORIGINS must list explicit origins in production; wildcards "
                "are not allowed with credentialed requests."
            )
        for origin in origins:
            if not origin.startswith("https://"):
                raise RuntimeError(
                    "Every CORS_ORIGINS entry must use https:// in production."
                )

        if not 5 <= int(self.ACCESS_TOKEN_EXPIRE_MINUTES) <= 1440:
            raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be between 5 and 1440.")
        if not 1 <= int(self.REFRESH_TOKEN_EXPIRE_DAYS) <= 90:
            raise RuntimeError("REFRESH_TOKEN_EXPIRE_DAYS must be between 1 and 90.")

        if not self.RATE_LIMIT_ENABLED:
            raise RuntimeError("RATE_LIMIT_ENABLED must be true in production.")
        if not 1 <= int(self.AUTH_RATE_LIMIT_PER_MINUTE) <= 600:
            raise RuntimeError(
                "AUTH_RATE_LIMIT_PER_MINUTE must be between 1 and 600 in production."
            )
        if int(self.MAX_REQUEST_BODY_BYTES) <= 0:
            raise RuntimeError("MAX_REQUEST_BODY_BYTES must be positive in production.")

        # Vercel overwrites X-Forwarded-For at its edge, so per-IP rate limits
        # must key off it there; otherwise every visitor shares the proxy IP.
        if not self.TRUST_PROXY_HEADERS and os.getenv("VERCEL") == "1":
            self.TRUST_PROXY_HEADERS = True


_ALLOWED_JWT_ALGORITHMS = frozenset({"HS256", "HS384", "HS512"})
_MIN_SECRET_KEY_LENGTH = 32
_PLACEHOLDER_SECRET_KEYS = frozenset(
    {
        "",
        "secret",
        "supersecret",
        "super-secret",
        "password",
        "changeme",
        "change-me",
        "change_me",
        "your-secret-key",
        "your_secret_key",
        "temporary_secret_for_deployment",
        "local-dev-secret",
        "development",
        "test",
    }
)
_PLACEHOLDER_SECRET_MARKERS = (
    "your-secret",
    "change-this",
    "change_this",
    "replace-me",
    "replace-this",
    "paste-a",
    "placeholder",
    "example-secret",
    "secret-here",
)
_UNCONFIGURED_DB_MARKERS = (
    "[your-password]",
    "<password>",
    "your-password",
    "changeme",
)


def _is_service_role_key(key: str) -> bool:
    """Detect Supabase service-role/secret keys without logging the value."""
    lowered = key.strip().lower()
    if lowered.startswith(("sb_secret_", "service_role")):
        return True
    parts = key.split(".")
    if len(parts) != 3:
        return False
    try:
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
    except Exception:
        return False
    return isinstance(decoded, dict) and decoded.get("role") == "service_role"


settings = Settings()
settings.validate_production_safety()
