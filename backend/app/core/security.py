"""
Security utilities — password hashing and JWT token management.
Includes input validation and safe error handling.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

_ALLOWED_ALGORITHMS = frozenset({"HS256", "HS384", "HS512"})
ALGORITHM = (settings.ALGORITHM or "HS256").upper()
if ALGORITHM not in _ALLOWED_ALGORITHMS:
    raise RuntimeError(f"Unsupported JWT algorithm: {ALGORITHM}")

# A process-local key keeps development usable without committing a secret.
# Production never reaches this branch: config validation requires SECRET_KEY.
_DEV_SIGNING_KEY = secrets.token_urlsafe(48)
_warned_about_dev_key = False


def _signing_key() -> str:
    global _warned_about_dev_key
    configured = (settings.SECRET_KEY or "").strip()
    if configured:
        return configured
    if settings.APP_ENV == "production":
        raise RuntimeError("SECRET_KEY is required in production")
    if not _warned_about_dev_key:
        logger.warning(
            "SECRET_KEY is not configured; using a process-local development key. "
            "Issued tokens become invalid when this process restarts."
        )
        _warned_about_dev_key = True
    return _DEV_SIGNING_KEY


def _create_token(
    *,
    subject: Union[str, Any],
    expires_delta: timedelta,
    token_type: str,
) -> str:
    if not subject:
        raise ValueError("Token subject cannot be empty")
    if token_type not in ("access", "refresh"):
        raise ValueError("Invalid token type")

    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": now,
        "type": token_type,
    }

    try:
        return jwt.encode(to_encode, _signing_key(), algorithm=ALGORITHM)
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


def _decode_token(token: str) -> Optional[dict]:
    if not token or not isinstance(token, str):
        return None

    try:
        return jwt.decode(
            token,
            _signing_key(),
            algorithms=[ALGORITHM],
            options={
                "require_exp": True,
                "require_iat": True,
                "require_sub": True,
            },
        )
    except JWTError as e:
        logger.debug("Token decode failed: %s", str(e))
        return None
    except Exception as e:
        logger.warning("Unexpected token decode error: %s", str(e))
        return None


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate an access JWT token.
    Returns the payload dict or None on failure.  Tokens without an explicit
    ``type`` claim are rejected so refresh tokens can never be replayed as
    access tokens (and vice versa).
    """
    payload = _decode_token(token)
    if not payload:
        return None
    if payload.get("type") != "access":
        return None
    return payload


def decode_refresh_token(token: str) -> Optional[dict]:
    payload = _decode_token(token)
    if not payload:
        return None
    if payload.get("type") != "refresh":
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
