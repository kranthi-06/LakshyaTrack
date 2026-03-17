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
    # Database
    # This must be the PostgreSQL Connection String (starts with postgresql://)
    # Get this from Supabase Dashboard > Settings > Database > Connection String
    DATABASE_URL: str = "postgresql://postgres.prrbjfnmuzxbtesrtvmc:Ashok%40yeddula011003@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
    # DATABASE_URL: str = "sqlite:///./local.db"
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "ai_career_platform"
    
    # API Access (for Auth/Storage if needed)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    
    # Security
    SECRET_KEY: str = "temporary_secret_for_deployment"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # External APIs
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    YOUTUBE_API_KEY: str = ""
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: str = ""
    
    # Email
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@example.com"
    
    # Admin System
    BLACK_ADMIN_EMAILS: str = ""  # Comma-separated emails for permanent super-admin access

    # AI caching (MongoDB Atlas)
    AI_CACHE_TTL_SECONDS: int = 60 * 60 * 24 * 7  # 7 days

    # Idempotency (MongoDB Atlas)
    IDEMPOTENCY_TTL_SECONDS: int = 60 * 60 * 24  # 24 hours
    IDEMPOTENCY_MAX_RESPONSE_BYTES: int = 1024 * 1024  # 1MB
    
    class Config:
        env_file = Path(__file__).resolve().parents[2] / ".env"

settings = Settings()

# Production guardrails:
# Keep behavior unchanged for development, but prevent accidental production runs
# with committed default secrets/URLs.
_DEFAULT_DATABASE_URL = "postgresql://postgres.prrbjfnmuzxbtesrtvmc:Ashok%40yeddula011003@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
_DEFAULT_SECRET_KEY = "temporary_secret_for_deployment"

if settings.APP_ENV.lower() == "production":
    if not settings.MONGODB_URI:
        raise RuntimeError("Missing required env var: MONGODB_URI (production)")
    if settings.DATABASE_URL == _DEFAULT_DATABASE_URL:
        raise RuntimeError("DATABASE_URL must be set via env var in production (default is not allowed).")
    if settings.SECRET_KEY == _DEFAULT_SECRET_KEY:
        raise RuntimeError("SECRET_KEY must be set via env var in production (default is not allowed).")
