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

ALGORITHM = "HS256"


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT access token.
    Uses timezone-aware datetimes (no deprecated utcnow).
    """
    if not subject:
        raise ValueError("Token subject cannot be empty")

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject), "iat": now}

    try:
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error("Failed to create access token: %s", str(e))
        raise


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.
    Returns the payload dict or None on failure.
    """
    if not token or not isinstance(token, str):
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.debug("Token decode failed: %s", str(e))
        return None
    except Exception as e:
        logger.warning("Unexpected token decode error: %s", str(e))
        return None


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
