"""
Security utilities — password hashing and JWT token management.
Includes input validation and safe error handling.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ALGORITHM = settings.ALGORITHM or "HS256"


def _create_token(
    *,
    subject: Union[str, Any],
    expires_delta: timedelta,
    token_type: str,
) -> str:
    if not subject:
        raise ValueError("Token subject cannot be empty")

    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": now,
        "type": token_type,
    }

    try:
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    except Exception as e:
        logger.error("Failed to create %s token: %s", token_type, str(e))
        raise


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT access token.
    Uses timezone-aware datetimes (no deprecated utcnow).
    """
    return _create_token(
        subject=subject,
        expires_delta=expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT refresh token."""
    return _create_token(
        subject=subject,
        expires_delta=expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.
    Returns the payload dict or None on failure.
    """
    if not token or not isinstance(token, str):
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            return None
        return payload
    except JWTError as e:
        logger.debug("Token decode failed: %s", str(e))
        return None
    except Exception as e:
        logger.warning("Unexpected token decode error: %s", str(e))
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    payload = decode_access_token(token)
    if not payload:
        return None
    if payload.get("type") not in (None, "refresh"):
        return None
    return payload


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash. Never raises."""
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.warning("Password verification error: %s", str(e))
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using Argon2. Validates input."""
    if not password or len(password) < 1:
        raise ValueError("Password cannot be empty")
    try:
        return pwd_context.hash(password)
    except Exception as e:
        logger.error("Password hashing failed: %s", str(e))
        raise
