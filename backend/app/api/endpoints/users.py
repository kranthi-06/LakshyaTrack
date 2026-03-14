from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()


# ── Schema for profile update request ────────────────────────
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    links: Optional[Dict[str, Any]] = None
    skills: Optional[List[str]] = None
    profile_photo_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    resume_url: Optional[str] = None
    certificate_url: Optional[str] = None
    project_image_url: Optional[str] = None


@router.post("/", response_model=schemas.user.User)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.user.UserCreate,
) -> Any:
    """
    Create new user.
    """
    user = crud.crud_user.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = crud.crud_user.create_user(db, user_in=user_in)
    return user


@router.get("/me", response_model=schemas.user.User)
def read_user_me(
    current_user: models.user.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


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
    update_data = profile_in.dict(exclude_unset=True)
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
