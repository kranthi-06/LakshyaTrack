from datetime import timedelta, datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import secrets
from app import crud, models, schemas
from app.api import deps
from app.api.deps import _get_black_admin_emails
from app.core import security
from app.core.config import settings
from app.services.subscription_service import (
    SubscriptionStateUnavailableError,
    get_subscription_status,
)
from app.services.email_service import send_email_otp
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def _generate_otp() -> str:
    """Cryptographically secure six-digit OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(6))


def _deliver_otp(email: str, otp_code: str) -> None:
    """Fail closed when the verification email cannot be delivered."""
    try:
        delivered = send_email_otp(email, otp_code)
    except Exception:
        logger.exception("OTP email delivery raised for %s", email)
        delivered = False
    if not delivered:
        logger.error("OTP email delivery failed for %s", email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification email could not be sent. Please try again shortly.",
        )


def _normalize_email_or_raise(email: str) -> str:
    normalized = crud.normalize_email(email)
    if not normalized:
        raise HTTPException(status_code=400, detail="Email is required")
    return normalized


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=16, max_length=4096)


class AuthSessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def _build_user_response_payload(db: Session, user: models.user.User) -> dict[str, Any]:
    hydrated_user = crud.get_user(db, user_id=user.id) or user
    role = deps._resolve_user_role(hydrated_user)
    payload = schemas.user.User.model_validate(hydrated_user).model_dump()
    try:
        payload["subscription_status"] = get_subscription_status(db, hydrated_user.id, role)
    except SubscriptionStateUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Subscription service temporarily unavailable",
        ) from exc
    return payload

@router.post("/signup")
def signup(
    user_in: schemas.user.UserCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Create new user.
    """
    email = _normalize_email_or_raise(user_in.email)

    # Check if user already exists and is verified
    user = crud.get_user_by_email(db, email=email)
    if user:
        if user.is_verified:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system.",
            )
        # If user exists but not verified, we could either delete the old one or just overwrite via OTP flow.
        # Since we are moving to deferred creation, if the user exists in 'users' table, it means 
        # it's a legacy unverified user or from before this change. 
        # For data consistency, let's treat them as if they need to register again (create OTP).
    
    # Generate OTP
    now = datetime.now(timezone.utc)
    otp_code = _generate_otp()
    expires_at = now + timedelta(minutes=5)
    
    # Prepare user data for deferred creation
    # We store the hashed password to avoid storing plaintext
    hashed_password = security.get_password_hash(user_in.password)
    
    user_data = {
        "email": email,
        "hashed_password": hashed_password,
        "full_name": user_in.full_name,
        "is_active": True,
        "is_verified": True # Will be set to True when created
    }
    
    # Store OTP with user data
    crud.create_otp(db, email=email, otp_code=otp_code, expires_at=expires_at, user_data=user_data)
    
    _deliver_otp(email, otp_code)

    return {"message": "Verification code sent to email."}

@router.post("/send-otp")
def send_otp(
    otp_in: schemas.otp.OTPRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Send OTP to email.
    """
    email = _normalize_email_or_raise(otp_in.email)
    user = crud.get_user_by_email(db, email=email)
    generic_response = {"message": "If this account can verify, a code has been sent."}
    
    # If user not found, check if there is a pending registration (OTP with user_data)
    pending_user_data = None
    if not user:
        latest_otp = crud.get_latest_otp(db, email=email)
        if latest_otp and latest_otp.user_data:
            pending_user_data = latest_otp.user_data
        else:
            return generic_response
            
    if user and user.is_verified:
        return generic_response

    # Check cooldown
    latest_otp = crud.get_latest_otp(db, email=email)
    
    # Ensure current time is timezone aware for comparison
    now = datetime.now(timezone.utc)
    
    if latest_otp:
        # DB datetime should be aware, but let's be safe
        otp_created_at = latest_otp.created_at
        if otp_created_at.tzinfo is None:
            otp_created_at = otp_created_at.replace(tzinfo=timezone.utc)
            
        if (now - otp_created_at).total_seconds() < 60:
            raise HTTPException(
                status_code=429,
                detail="Please wait 60 seconds before requesting a new OTP.",
            )

    # Generate OTP
    otp_code = _generate_otp()
    expires_at = now + timedelta(minutes=5)
    
    logger.info("Generated OTP for resend flow: %s", email)

    # Store OTP
    # If we have pending_user_data, pass it along so the new OTP can also create the user
    crud.create_otp(db, email=email, otp_code=otp_code, expires_at=expires_at, user_data=pending_user_data)

    _deliver_otp(email, otp_code)

    return {"message": "OTP sent successfully."}

@router.post("/verify-otp")
def verify_otp(
    otp_in: schemas.otp.OTPVerify,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Verify OTP and activate user account.
    """
    email = _normalize_email_or_raise(otp_in.email)
    user = crud.get_user_by_email(db, email=email)
    # logic changed: user might be None if deferred registration
    # if not user:
    #    raise HTTPException(status_code=404, detail="User not found")
        
    latest_otp = crud.get_latest_otp(db, email=email)
    if not latest_otp:
        raise HTTPException(status_code=400, detail="No OTP request found")
        
    # Check expiry
    # DB stores datetime with timezone (UTC). We must compare with aware datetime.
    now = datetime.now(timezone.utc)
    
    # Ensure database datetime is treated as aware if it comes back naive (unlikely with this error but safe)
    otp_expires_at = latest_otp.expires_at
    if otp_expires_at.tzinfo is None:
        otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)
        
    if now > otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
        
    # Check attempts
    if latest_otp.attempts >= 5:
         raise HTTPException(status_code=400, detail="Too many attempts. Request a new OTP.")
         
    # Check if used
    if latest_otp.is_used:
         raise HTTPException(status_code=400, detail="OTP already used")

    # Verify Hash
    if not security.verify_password(otp_in.otp, latest_otp.hashed_otp):
        crud.increment_attempts(db, latest_otp)
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Consume the OTP atomically before any account side effects so two
    # concurrent verification requests cannot both succeed.
    if not crud.claim_otp_as_used(db, latest_otp):
        raise HTTPException(status_code=400, detail="OTP already used")
        
    # Check if we need to create the user (Deferred Registration)
    if user:
        # User already exists (old flow or password reset or unverified user)
        # If OTP contains fresh user data (e.g., new password), merge it in.
        if latest_otp.user_data:
            user_data = dict(latest_otp.user_data)  # Copy dict
            full_name = user_data.pop("full_name", None)

            # Only allow specific fields to update existing user safely
            for field in ("hashed_password", "is_active", "is_verified", "login_type"):
                value = user_data.get(field)
                if value is not None and value != "":
                    setattr(user, field, value)

            # Update or create profile if full_name provided
            if full_name:
                profile = user.profile
                if not profile:
                    profile = models.Profile(id=user.id)
                profile.full_name = full_name
                db.add(profile)

        user.is_verified = True
        user.is_active = True
        db.add(user)
    elif latest_otp.user_data:
        # Create new user from stored data
        user_data = dict(latest_otp.user_data) # Copy dict
        
        # Extract fields that don't belong to User model
        full_name = user_data.pop("full_name", None)
        
        # Ensure we don't pass fields that might not be in User model or handle mismatched
        user = models.User(**user_data)
        db.add(user)
        # We need to commit here to get the user ID for token generation
        db.commit()
        db.refresh(user)
        
        # Create Profile if full_name is present
        if full_name:
            profile = models.Profile(id=user.id, full_name=full_name)
            db.add(profile)
            db.commit() 
        
    else:
        # User not found and no user_data? Should not happen in new flow
        raise HTTPException(status_code=400, detail="Registration data not found. Please sign up again.")
    
    db.commit()
    
    # Generate access token so user is automatically logged in
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    
    return {
        "message": "Email verified successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user": _build_user_response_payload(db, user),
    }

@router.post("/login/access-token", response_model=schemas.user.TokenWithUser)
def login_access_token(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    email = _normalize_email_or_raise(form_data.username)
    user = crud.get_user_by_email(db, email=email)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified. Please verify your email first.")
    
    # ── BLACKLIST CHECK AT LOGIN ──────────────────────────────
    black_emails = _get_black_admin_emails()
    is_black_admin = user.email and user.email.lower() in black_emails
    
    if not is_black_admin and user.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been permanently blocked by admin."
        )
    
    # ── SYNC ROLE + UPDATE ACTIVITY (single commit) ──────────
    if is_black_admin and user.role != "black_admin":
        user.role = "black_admin"
        user.is_blacklisted = False
    user.last_active_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "user": _build_user_response_payload(db, user),
    }


@router.post("/auth/register")
def register_alias(
    user_in: schemas.user.UserCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """Alias for the SaaS auth contract."""
    return signup(user_in=user_in, db=db)


@router.post("/auth/login", response_model=AuthSessionResponse)
def login_alias(
    body: LoginRequest,
    db: Session = Depends(deps.get_db),
) -> Any:
    """JSON login alias that returns access and refresh tokens."""
    email = _normalize_email_or_raise(body.email)
    user = crud.get_user_by_email(db, email=email)
    if not user or not security.verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified. Please verify your email first.")

    black_emails = _get_black_admin_emails()
    is_black_admin = user.email and user.email.lower() in black_emails
    if not is_black_admin and user.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been permanently blocked by admin."
        )
    if is_black_admin and user.role != "black_admin":
        user.role = "black_admin"
        user.is_blacklisted = False
    user.last_active_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()

    return AuthSessionResponse(
        access_token=security.create_access_token(
            user.id,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        refresh_token=security.create_refresh_token(user.id),
    )


@router.get("/auth/me")
def me_alias(
    db: Session = Depends(deps.get_db),
    current_user: models.user.User = Depends(deps.get_current_active_user),
) -> Any:
    """Alias for the SaaS auth contract with a JSON-safe user payload."""
    return _build_user_response_payload(db, current_user)


@router.post("/auth/refresh", response_model=AuthSessionResponse)
def refresh_session(
    body: RefreshTokenRequest,
    db: Session = Depends(deps.get_db),
) -> Any:
    payload = security.decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # ``crud.get_user`` resolves both PostgreSQL UUIDs and SQLite integer IDs.
    # Pre-coercing every subject to UUID made refresh tokens issued in the
    # isolated SQLite environment unusable.
    user = crud.get_user(db, user_id=user_id)

    if not user or not user.is_active or not user.is_verified:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    black_emails = _get_black_admin_emails()
    is_black_admin = user.email and user.email.lower() in black_emails
    if not is_black_admin and user.is_blacklisted:
        raise HTTPException(status_code=403, detail="Account is blocked")

    return AuthSessionResponse(
        access_token=security.create_access_token(
            user.id,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        refresh_token=security.create_refresh_token(user.id),
    )

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

class GoogleToken(BaseModel):
    token: str = Field(min_length=16, max_length=4096)

@router.post("/google-login", response_model=schemas.user.TokenWithUser)
def google_login(
    token_data: GoogleToken,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Login or Register with Google ID Token.
    """
    try:
        # SECURITY: never accept an arbitrary Google token in production.
        google_client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
        if not google_client_id:
            if settings.APP_ENV == "production":
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Google sign-in is not configured.",
                )
            logger.warning("Google login: GOOGLE_CLIENT_ID not set — development mode accepts any audience.")

        id_info = id_token.verify_oauth2_token(
            token_data.token,
            google_requests.Request(),
            audience=google_client_id or None,
        )

        if id_info.get("email_verified") is not True:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Google account email is not verified.",
            )

        email = _normalize_email_or_raise(id_info['email'])
        name = id_info.get('name', '')
        user = crud.get_user_by_email(db, email=email)
        if not user:
            random_password = secrets.token_urlsafe(32)
            hashed_password = security.get_password_hash(random_password)

            user = models.User(
                email=email,
                hashed_password=hashed_password,
                is_active=True,
                is_verified=True,
                login_type="google"
            )
            db.add(user)
            db.flush()
            db.add(models.Profile(id=user.id, full_name=name))
            db.commit()
            db.refresh(user)
        else:
            # Never merge a verified Google identity into a password account by
            # email alone: that would let whoever controls the Google address
            # silently take over an existing local account.
            if (user.login_type or "custom").lower() == "custom":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists. Sign in with your existing method.",
                )
            if not user.is_verified:
                user.is_verified = True
                db.add(user)
                db.commit()
        
        # ── BLACKLIST CHECK AT GOOGLE LOGIN ──────────────────
        black_emails = _get_black_admin_emails()
        is_black_admin = user.email and user.email.lower() in black_emails
        
        if not is_black_admin and user.is_blacklisted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been permanently blocked by admin."
            )
        
        # ── SYNC ROLE + ACTIVITY (single commit) ─────────────
        if is_black_admin and user.role != "black_admin":
            user.role = "black_admin"
            user.is_blacklisted = False
        user.last_active_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
        
        # Determine User ID
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return {
            "access_token": security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            "token_type": "bearer",
            "user": _build_user_response_payload(db, user),
        }

    except HTTPException:
        raise
    except ValueError as e:
        # Invalid token
        logger.warning("Invalid Google token: %s", str(e))
        raise HTTPException(status_code=400, detail="Invalid Google token")
    except Exception as e:
        logger.exception("Google login failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Google Login failed")
