from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Use the DATABASE_URL from settings directly
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

_is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    # Connection pool tuning (ignored for sqlite)
    **({"pool_size": 10, "max_overflow": 20, "pool_recycle": 1800} if not _is_sqlite else {}),
    connect_args={"check_same_thread": False} if _is_sqlite else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
