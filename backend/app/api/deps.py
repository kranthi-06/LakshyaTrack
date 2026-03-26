import hashlib
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.crud import crud_user
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")
LAST_ACTIVE_WRITE_INTERVAL = timedelta(minutes=10)
_LAST_ACTIVE_MAX_ENTRIES = 10_000
_EXTERNAL_TOKEN_CACHE_TTL = timedelta(minutes=5)
_EXTERNAL_TOKEN_VERIFY_TIMEOUT_SECONDS = 5

_last_active_flush: dict[str, datetime] = {}
_last_daily_activity_mark: dict[str, date] = {}
_external_token_identity_cache: dict[str, tuple[datetime, dict[str, Any]]] = {}


def _get_black_admin_emails() -> list:
    raw = settings.BLACK_ADMIN_EMAILS or ""
    return [e.strip().lower() for e in raw.split(",") if e.strip()]


def _resolve_user_role(user: User) -> str:
    black_emails = _get_black_admin_emails()
    if user.email and user.email.lower() in black_emails:
        return "black_admin"
    return user.role or "user"


def _coerce_utc_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _prune_external_token_cache() -> None:
    if len(_external_token_identity_cache) <= _LAST_ACTIVE_MAX_ENTRIES:
        return
    sorted_keys = sorted(_external_token_identity_cache, key=lambda key: _external_token_identity_cache[key][0])
    for key in sorted_keys[: len(sorted_keys) // 2]:
        _external_token_identity_cache.pop(key, None)


def _build_external_identity(raw_user: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not isinstance(raw_user, dict):
        return None

    user_id = raw_user.get("id")
    email = crud_user.normalize_email(raw_user.get("email"))
    if not user_id or not email:
        return None

    user_metadata = raw_user.get("user_metadata")
    if not isinstance(user_metadata, dict):
        user_metadata = {}

    app_metadata = raw_user.get("app_metadata")
    if not isinstance(app_metadata, dict):
        app_metadata = {}

    providers = app_metadata.get("providers")
    provider = app_metadata.get("provider")
    if not provider and isinstance(providers, list) and providers:
        provider = providers[0]

    return {
        "sub": str(user_id),
        "email": email,
        "name": user_metadata.get("full_name") or user_metadata.get("name"),
        "user_metadata": user_metadata,
        "provider": provider or "supabase",
    }


def _verify_supabase_access_token(token: str) -> Optional[dict[str, Any]]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None

    cache_key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    cached = _external_token_identity_cache.get(cache_key)
    if cached:
        expires_at, identity = cached
        if expires_at > now:
            return identity
        _external_token_identity_cache.pop(cache_key, None)

    try:
        response = requests.get(
            f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=_EXTERNAL_TOKEN_VERIFY_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.warning("Supabase token verification failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider unavailable",
        ) from exc

    if response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
        return None

    if response.status_code >= 500:
        logger.warning(
            "Supabase auth verification returned %s: %s",
            response.status_code,
            response.text[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider unavailable",
        )

    if response.status_code != status.HTTP_200_OK:
        logger.warning("Unexpected Supabase auth status %s while verifying token.", response.status_code)
        return None

    try:
        identity = _build_external_identity(response.json())
    except ValueError:
        logger.warning("Supabase auth user response was not valid JSON.")
        return None

    if not identity:
        return None

    _external_token_identity_cache[cache_key] = (now + _EXTERNAL_TOKEN_CACHE_TTL, identity)
    _prune_external_token_cache()
    return identity


def _resolve_token_identity(token: str) -> Optional[dict[str, Any]]:
    internal_payload = decode_access_token(token)
    if internal_payload:
        email = crud_user.normalize_email(internal_payload.get("email"))
        if email:
            internal_payload["email"] = email
        return internal_payload
    return _verify_supabase_access_token(token)


def touch_user_auth_activity(
    db: Session,
    user: User,
    *,
    now: Optional[datetime] = None,
) -> None:
    now_utc = _coerce_utc_datetime(now) or datetime.now(timezone.utc)
    user_key = str(user.id)
    last_flush = _coerce_utc_datetime(_last_active_flush.get(user_key))
    current_last_active = _coerce_utc_datetime(user.last_active_at)

    should_flush = (
        current_last_active is None
        or last_flush is None
        or (now_utc - last_flush) >= LAST_ACTIVE_WRITE_INTERVAL
        or (now_utc - current_last_active) >= LAST_ACTIVE_WRITE_INTERVAL
    )

    if should_flush:
        user.last_active_at = now_utc
        db.add(user)
        db.commit()
        _last_active_flush[user_key] = now_utc
        if len(_last_active_flush) > _LAST_ACTIVE_MAX_ENTRIES:
            sorted_keys = sorted(_last_active_flush, key=_last_active_flush.get)  # type: ignore[arg-type]
            for key in sorted_keys[: len(sorted_keys) // 2]:
                _last_active_flush.pop(key, None)

    if _last_daily_activity_mark.get(user_key) == now_utc.date():
        return

    try:
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        from app.models.career import UserActivityDay

        today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
        stmt = pg_insert(UserActivityDay).values(
            user_id=user.id,
            activity_date=today_start,
            activity_count=1,
        ).on_conflict_do_nothing(
            constraint="uq_user_activity_day",
        )
        db.execute(stmt)
        db.commit()
        _last_daily_activity_mark[user_key] = now_utc.date()
        if len(_last_daily_activity_mark) > _LAST_ACTIVE_MAX_ENTRIES:
            oldest_keys = list(_last_daily_activity_mark.keys())[: len(_last_daily_activity_mark) // 2]
            for key in oldest_keys:
                _last_daily_activity_mark.pop(key, None)
    except Exception:
        db.rollback()


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    def get_credentials_exception(detail_msg: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail_msg,
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _resolve_token_identity(token)
    if payload is None:
        raise get_credentials_exception("Could not validate credentials")

    user_id = payload.get("sub")
    email = crud_user.normalize_email(payload.get("email"))
    if user_id is None:
        raise get_credentials_exception("Token missing 'sub' claim")

    user = None
    try:
        import uuid

        uuid_obj = uuid.UUID(str(user_id))
        user = crud_user.get_user(db, user_id=uuid_obj)
    except (ValueError, TypeError):
        pass
    except Exception:
        pass

    if not user and email:
        user = crud_user.get_user_by_email(db, email=email)

    if not user and email:
        try:
            import random

            from app.core import security
            from app.models.user import Profile
            from app.models.user import User as UserModel

            random_password = "".join([str(random.randint(0, 9)) for _ in range(16)])
            hashed_password = security.get_password_hash(random_password)
            login_type = payload.get("provider") or "google_or_supabase"
            user_metadata = payload.get("user_metadata")
            if not isinstance(user_metadata, dict):
                user_metadata = {}

            new_user = UserModel(
                email=email,
                hashed_password=hashed_password,
                is_active=True,
                is_verified=True,
                login_type=login_type,
                role="user",
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            user = new_user

            full_name = user_metadata.get("full_name") or payload.get("name") or email.split("@")[0]
            profile = Profile(id=user.id, full_name=full_name)
            db.add(profile)
            db.commit()
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Auto-provisioning authenticated user failed: %s", str(exc))
            raise get_credentials_exception("Could not validate credentials")

    if not user:
        raise get_credentials_exception("User not found or validation failed")

    effective_role = _resolve_user_role(user)
    if effective_role != "black_admin" and user.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been permanently blocked by admin.",
        )

    if effective_role == "black_admin" and user.role != "black_admin":
        user.role = "black_admin"
        user.is_blacklisted = False
        db.add(user)
        db.commit()
        db.refresh(user)

    try:
        touch_user_auth_activity(db, user)
    except Exception:
        db.rollback()

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(
        OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False)
    ),
) -> Optional[User]:
    if not token:
        return None
    try:
        return get_current_user(db, token)
    except Exception:
        return None


def require_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    effective_role = _resolve_user_role(current_user)
    if effective_role not in ("admin", "black_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def require_black_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    effective_role = _resolve_user_role(current_user)
    if effective_role != "black_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required.",
        )
    return current_user
