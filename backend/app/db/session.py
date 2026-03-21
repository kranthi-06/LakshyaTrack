"""
Database session layer — production-grade with connection pooling,
health monitoring, automatic reconnection, and pool pre-warming.
"""
import logging
import time
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
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
        "pool_size": settings.DB_POOL_SIZE,                  # Maintained connections
        "max_overflow": settings.DB_MAX_OVERFLOW,            # Extra connections under load
        "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,    # Wait for a connection (seconds)
        "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,    # Recycle connections
        "pool_pre_ping": True,    # Verify connections before use
        "echo": False,
    })

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)




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
    Returns a status dict with pool statistics.
    """
    try:
        start = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = (time.monotonic() - start) * 1000
        pool = engine.pool
        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 1),
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


def safe_db_execute(db: Session, func, *args, operation_name: str = "db_operation", max_retries: int = 2, **kwargs):
    """
    Execute a database operation with automatic retry on transient errors.
    
    Usage:
        result = safe_db_execute(db, my_query_func, arg1, arg2, operation_name="fetch_user")
    
    Args:
        db: SQLAlchemy session
        func: Callable to execute
        operation_name: Name for logging
        max_retries: Number of retry attempts on transient errors
    """
    last_exception = None
    for attempt in range(max_retries + 1):
        try:
            result = func(db, *args, **kwargs)
            return result
        except OperationalError as e:
            last_exception = e
            if attempt < max_retries:
                logger.warning(
                    "DB OperationalError on %s (attempt %d/%d): %s",
                    operation_name, attempt + 1, max_retries, str(e),
                )
                db.rollback()
                continue
            raise
        except DBAPIError as e:
            last_exception = e
            if e.connection_invalidated and attempt < max_retries:
                logger.warning(
                    "DB connection invalidated on %s (attempt %d/%d): %s",
                    operation_name, attempt + 1, max_retries, str(e),
                )
                db.rollback()
                continue
            raise
    raise last_exception  # Should not reach here


def prewarm_pool(min_connections: int = 3) -> None:
    """
    Pre-warm the connection pool by checking out and returning connections.
    Call once at startup to avoid cold-start latency on the first real request.
    """
    if _is_sqlite:
        return
    connections = []
    target = min(min_connections, settings.DB_POOL_SIZE)
    try:
        for _ in range(target):
            conn = engine.connect()
            conn.execute(text("SELECT 1"))
            connections.append(conn)
        logger.info("Connection pool pre-warmed with %d connections.", target)
    except Exception as e:
        logger.warning("Pool pre-warm failed (non-fatal): %s", str(e))
    finally:
        for conn in connections:
            try:
                conn.close()
            except Exception:
                pass
