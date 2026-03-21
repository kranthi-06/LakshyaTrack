from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.db.session import get_db  # Use production-grade session factory
from app.core.config import settings
from app.core.security import decode_access_token
from app.models.user import User
from app.crud import crud_user
from app.schemas.user import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")
LAST_ACTIVE_WRITE_INTERVAL = timedelta(minutes=10)
_LAST_ACTIVE_MAX_ENTRIES = 10_000  # Bound memory even with millions of users
_last_active_flush: dict[str, datetime] = {}

def _get_black_admin_emails() -> list:
    """Parse BLACK_ADMIN_EMAILS from env config."""
    raw = settings.BLACK_ADMIN_EMAILS or ""
    return [e.strip().lower() for e in raw.split(",") if e.strip()]

def _resolve_user_role(user: User) -> str:
    """
    Resolve the effective role for a user.
    BLACK_ADMIN_EMAILS override always takes precedence.
    """
    black_emails = _get_black_admin_emails()
    if user.email and user.email.lower() in black_emails:
        return "black_admin"
    return user.role or "user"

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    # Define credential exception generator to allow dynamic details
    def get_credentials_exception(detail_msg: str):
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail_msg,
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(token)
        # Backward-compat fallback for externally issued tokens.
        # Keep this to avoid breaking current mixed token flows,
        # but no longer leak raw JWT errors to clients.
        if payload is None:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                options={"verify_signature": False, "verify_aud": False},
            )

        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None:
            raise get_credentials_exception("Token missing 'sub' claim")
            
    except (JWTError, ValidationError):
        raise get_credentials_exception("Could not validate credentials")
        
    # 1. Try finding user by ID (Standard backend flow)
    user = None
    try:
        import uuid
        uuid_obj = uuid.UUID(str(user_id))
        user = crud_user.get_user(db, user_id=uuid_obj)
    except (ValueError, TypeError):
        pass
    except Exception:
        pass
    
    # 2. If not found, try by EMAIL (Supabase flow or mixed ID)
    if not user and email:
        user = crud_user.get_user_by_email(db, email=email)
        
    # 3. If still not found, auto-provision
    if not user and email:
        try:
            import random
            from app.core import security
            random_password =  "".join([str(random.randint(0, 9)) for _ in range(16)])
            hashed_password = security.get_password_hash(random_password)
            
            from app.models.user import User as UserModel
            new_user = UserModel(
                email=email,
                hashed_password=hashed_password,
                is_active=True,
                is_verified=True,
                login_type="google_or_supabase",
                role="user"
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            user = new_user
            
            from app.models.user import Profile
            full_name = payload.get("user_metadata", {}).get("full_name") or payload.get("name") or email.split("@")[0]
            profile = Profile(id=user.id, full_name=full_name)
            db.add(profile)
            db.commit()
            
        except Exception:
            raise get_credentials_exception("Could not validate credentials")

    if not user:
        raise get_credentials_exception("User not found or validation failed")
    
    # ── BLACKLIST CHECK ──────────────────────────────────────
    # Black admins are NEVER blocked by blacklist
    effective_role = _resolve_user_role(user)
    if effective_role != "black_admin" and user.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been permanently blocked by admin."
        )
    
    # ── FORCE ROLE SYNC ──────────────────────────────────────
    # If env override says black_admin but DB differs, fix DB
    if effective_role == "black_admin" and user.role != "black_admin":
        user.role = "black_admin"
        user.is_blacklisted = False  # Safety: never blacklist a black_admin
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # ── UPDATE LAST ACTIVE ───────────────────────────────────
    try:
        now = datetime.now(timezone.utc)
        user_key = str(user.id)
        last_flush = _last_active_flush.get(user_key)
        should_flush = (
            user.last_active_at is None
            or last_flush is None
            or (now - last_flush) >= LAST_ACTIVE_WRITE_INTERVAL
            or (now - user.last_active_at) >= LAST_ACTIVE_WRITE_INTERVAL
        )
        if should_flush:
            user.last_active_at = now
            db.add(user)
            db.commit()
            _last_active_flush[user_key] = now
            # Evict oldest entries when dict grows too large (millions of users)
            if len(_last_active_flush) > _LAST_ACTIVE_MAX_ENTRIES:
                sorted_keys = sorted(_last_active_flush, key=_last_active_flush.get)  # type: ignore
                for k in sorted_keys[:len(sorted_keys) // 2]:
                    _last_active_flush.pop(k, None)
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
    token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False))
) -> Optional[User]:
    if not token:
        return None
    try:
        return get_current_user(db, token)
    except Exception:
        return None

# ══════════════════════════════════════════════════════════════
# ADMIN DEPENDENCY GUARDS
# ══════════════════════════════════════════════════════════════

def require_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Require role == 'admin' OR 'black_admin'.
    Used for read-only admin views.
    """
    effective_role = _resolve_user_role(current_user)
    if effective_role not in ("admin", "black_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required."
        )
    return current_user

def require_black_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Require role == 'black_admin' ONLY.
    Used for destructive actions: delete, blacklist, promote, demote.
    """
    effective_role = _resolve_user_role(current_user)
    if effective_role != "black_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required."
        )
    return current_user
