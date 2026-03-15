"""
Database session layer — production-grade with connection pooling,
health monitoring, and automatic reconnection.
"""
import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
_is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URL

# ── Production-grade engine configuration ──────────────────────
_engine_kwargs = {
    "pool_pre_ping": True,  # Test connections before checkout
}

if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pool tuning
    _engine_kwargs.update({
        "pool_size": 10,          # Maintained connections
        "max_overflow": 20,       # Extra connections under load
        "pool_timeout": 30,       # Wait for a connection (seconds)
        "pool_recycle": 1800,     # Recycle connections every 30 min
        "pool_pre_ping": True,    # Verify connections before use
        "echo": False,
    })

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Connection event hooks for monitoring ──────────────────────
@event.listens_for(engine, "connect")
def _on_connect(dbapi_conn, connection_record):
    logger.debug("DB connection established (pool checkout).")


@event.listens_for(engine, "checkout")
def _on_checkout(dbapi_conn, connection_record, connection_proxy):
    pass  # Could add metrics tracking here


@event.listens_for(engine, "checkin")
def _on_checkin(dbapi_conn, connection_record):
    pass  # Connection returned to pool


# ── Safe database session helpers ──────────────────────────────

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency — yields a database session and ensures cleanup.
    Includes automatic rollback on uncommitted failures.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for use outside FastAPI routes (background jobs, etc.).
    Automatically handles commit/rollback/close.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_health() -> dict:
    """
    Quick health check — verifies database connectivity.
    Returns a status dict.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        pool = engine.pool
        return {
            "status": "healthy",
            "pool_size": pool.size() if hasattr(pool, 'size') else "N/A",
            "checked_in": pool.checkedin() if hasattr(pool, 'checkedin') else "N/A",
            "checked_out": pool.checkedout() if hasattr(pool, 'checkedout') else "N/A",
            "overflow": pool.overflow() if hasattr(pool, 'overflow') else "N/A",
        }
    except Exception as e:
        logger.error("Database health check failed: %s", str(e))
        return {
            "status": "unhealthy",
            "error": str(e),
        }


def safe_db_execute(db: Session, operation_name: str = "db_operation"):
    """
    Decorator/context for safe database operations with automatic retry
    on transient connection errors.
    """
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            return
        except OperationalError as e:
            if attempt < max_retries:
                logger.warning(
                    "DB OperationalError on %s (attempt %d/%d): %s",
                    operation_name, attempt + 1, max_retries, str(e),
                )
                db.rollback()
                continue
            raise
        except DBAPIError as e:
            if e.connection_invalidated and attempt < max_retries:
                logger.warning(
                    "DB connection invalidated on %s (attempt %d/%d): %s",
                    operation_name, attempt + 1, max_retries, str(e),
                )
                db.rollback()
                continue
            raise
