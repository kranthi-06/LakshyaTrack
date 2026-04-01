from pathlib import Path

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Career Platform"
    API_V1_STR: str = "/api/v1"
    # Environment
    # - development: permissive defaults for local runs
    # - production: require explicit env vars for secrets/DB
    APP_ENV: str = "development"
    
    # Database
    # Set DATABASE_URL via environment variable or .env file.
    # For local development, defaults to SQLite. In production, must be PostgreSQL.
    DATABASE_URL: str = "sqlite:///./local.db"
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "ai_career_platform"
    
    # API Access (for Auth/Storage if needed)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    
    # Security
    SECRET_KEY: str = "temporary_secret_for_deployment"
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
    GOOGLE_CLIENT_ID: str = ""  # For Google OAuth audience validation
    
    # Email
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@example.com"
    
    # Admin System
    BLACK_ADMIN_EMAILS: str = ""  # Comma-separated emails for permanent super-admin access
    CORS_ORIGINS: str = "*"

    # AI caching (MongoDB Atlas)
    AI_CACHE_TTL_SECONDS: int = 60 * 60 * 24 * 7  # 7 days

    # Idempotency (MongoDB Atlas)
    IDEMPOTENCY_TTL_SECONDS: int = 60 * 60 * 24  # 24 hours
    IDEMPOTENCY_MAX_RESPONSE_BYTES: int = 1024 * 1024  # 1MB

    # Request protection and load tuning
    RATE_LIMIT_ENABLED: bool = False
    RATE_LIMIT_BACKEND: str = "auto"  # auto | memory | redis
    RATE_LIMIT_GLOBAL_PER_MINUTE: int = 12000
    RATE_LIMIT_IP_PER_MINUTE: int = 2400
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

    def get_cors_origins(self) -> list[str]:
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

settings = Settings()

# Production guardrails:
# Keep behavior unchanged for development, but prevent accidental production runs
# with committed default secrets/URLs.
_DEFAULT_DATABASE_URL = "sqlite:///./local.db"
_DEFAULT_SECRET_KEY = "temporary_secret_for_deployment"

if settings.APP_ENV.lower() == "production":
    if not settings.MONGODB_URI:
        raise RuntimeError("Missing required env var: MONGODB_URI (production)")
    if settings.DATABASE_URL == _DEFAULT_DATABASE_URL or "sqlite" in settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL must be set to PostgreSQL via env var in production.")
    if settings.SECRET_KEY == _DEFAULT_SECRET_KEY:
        raise RuntimeError("SECRET_KEY must be set via env var in production (default is not allowed).")
