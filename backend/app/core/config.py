from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Career Platform"
    API_V1_STR: str = "/api/v1"
    
    # Database
    # Database
    # This must be the PostgreSQL Connection String (starts with postgresql://)
    # Get this from Supabase Dashboard > Settings > Database > Connection String
    DATABASE_URL: str = "postgresql://postgres.prrbjfnmuzxbtesrtvmc:Ashok%40yeddula011003@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
    # DATABASE_URL: str = "sqlite:///./local.db"
    
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
    
    class Config:
        env_file = ".env"

settings = Settings()
