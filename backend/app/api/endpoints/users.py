import json
from typing import Any, List, Optional, Dict
from urllib.parse import urlparse

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.services.subscription_service import (
    SubscriptionStateUnavailableError,
    get_subscription_status,
)

router = APIRouter()

_URL_FIELDS = (
    "profile_photo_url",
    "profile_image_url",
    "resume_url",
    "certificate_url",
    "project_image_url",
)


# ── Schema for profile update request ────────────────────────
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    bio: Optional[str] = Field(default=None, max_length=2000)
    links: Optional[Dict[str, Any]] = None
    skills: Optional[List[str]] = None
    profile_photo_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    resume_url: Optional[str] = None
    certificate_url: Optional[str] = None
    project_image_url: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def _validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            return cleaned
        if not all(ch.isdigit() or ch in "+-() " for ch in cleaned):
            raise ValueError("Phone number contains unsupported characters")
        return cleaned

    @field_validator(*_URL_FIELDS)
    @classmethod
    def _validate_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return value
        if len(value) > 2048:
            raise ValueError("URL is too long")
        parsed = urlparse(value)
        if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
            raise ValueError("URL must use http or https")
        return value

    @field_validator("skills")
    @classmethod
    def _validate_skills(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        if len(value) > 50:
            raise ValueError("Too many skills")
        cleaned: List[str] = []
        for skill in value:
            if not isinstance(skill, str):
                raise ValueError("Skills must be strings")
            skill = skill.strip()
            if not skill:
                continue
            if len(skill) > 64:
                raise ValueError("Skill name is too long")
            cleaned.append(skill)
        return cleaned

    @field_validator("links")
    @classmethod
    def _validate_links(cls, value: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if value is None:
            return value
        if len(value) > 30:
            raise ValueError("Too many profile links")
        for key, item in value.items():
            if not isinstance(key, str) or len(key) > 64:
                raise ValueError("Invalid link key")
            if isinstance(item, str) and len(item) > 2048:
                raise ValueError("Profile link value is too long")
        try:
            encoded = json.dumps(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Profile links must be JSON serializable") from exc
        if len(encoded) > 16_384:
            raise ValueError("Profile links payload is too large")
        return value


@router.post("/", response_model=schemas.user.User)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.user.UserCreate,
    admin: models.user.User = Depends(deps.require_admin),
) -> Any:
    """
    Admin-only direct user creation. Public registration must use /signup plus
    OTP verification.
    """
    email = crud.normalize_email(user_in.email)
    user = crud.crud_user.get_user_by_email(db, email=email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    if user_in.is_superuser and deps._resolve_user_role(admin) != "black_admin":
        raise HTTPException(
            status_code=403,
            detail="Only a super admin can create a superuser.",
        )
    user_in = user_in.model_copy(update={"email": email})
    user = crud.crud_user.create_user(db, user_in=user_in)
    return user


@router.get("/me", response_model=schemas.user.User)
def read_user_me(
    db: Session = Depends(deps.get_db),
    current_user: models.user.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    role = deps._resolve_user_role(current_user)
    payload = schemas.user.User.model_validate(current_user).model_dump()
    try:
        payload["subscription_status"] = get_subscription_status(db, current_user.id, role)
    except SubscriptionStateUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Subscription service temporarily unavailable",
        ) from exc
    return payload


@router.put("/me/profile", response_model=schemas.user.User)
def update_my_profile(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.user.User = Depends(deps.get_current_active_user),
    profile_in: ProfileUpdateRequest,
) -> Any:
    """
    Update the current user's profile (name, phone, bio, links, skills, photo).
    Creates the profile row if it doesn't exist yet.
    """
    profile = current_user.profile

    # Create profile if it doesn't exist
    if not profile:
        profile = models.user.Profile(id=current_user.id)
        db.add(profile)
        db.flush()
        # Re-fetch so the relationship is populated
        db.refresh(current_user)
        profile = current_user.profile

    # Patch only fields that were explicitly sent
    update_data = profile_in.model_dump(exclude_unset=True)
    profile_image_url = update_data.pop("profile_image_url", None)
    legacy_profile_photo_url = update_data.pop("profile_photo_url", None)

    for field, value in update_data.items():
        setattr(profile, field, value)

    resolved_profile_image = profile_image_url
    if resolved_profile_image is None and legacy_profile_photo_url is not None:
        resolved_profile_image = legacy_profile_photo_url

    if resolved_profile_image is not None:
        profile.profile_image_url = resolved_profile_image
        profile.profile_photo_url = resolved_profile_image

    db.add(profile)
    db.commit()
    db.refresh(current_user)

    return current_user
