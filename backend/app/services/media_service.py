from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import Profile
from app.services.cloudinary_service import MediaType


PROFILE_MEDIA_FIELDS = {
    MediaType.RESUME: "resume_url",
    MediaType.PROFILE_IMAGE: "profile_image_url",
    MediaType.CERTIFICATE: "certificate_url",
    MediaType.PROJECT_IMAGE: "project_image_url",
    MediaType.PORTFOLIO_IMAGE: "project_image_url",
}


def get_or_create_profile(db: Session, user_id: UUID) -> Profile:
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if profile:
        return profile

    profile = Profile(id=user_id)
    db.add(profile)
    db.flush()
    return profile


def assign_profile_media_url(profile: Profile, media_type: MediaType, secure_url: str) -> Optional[str]:
    field_name = PROFILE_MEDIA_FIELDS.get(media_type)
    if not field_name:
        return None

    setattr(profile, field_name, secure_url)
    if media_type == MediaType.PROFILE_IMAGE:
        # Keep the legacy field populated so existing clients still render correctly.
        profile.profile_photo_url = secure_url

    return field_name


def persist_profile_media_url(
    db: Session,
    user_id: UUID,
    media_type: MediaType,
    secure_url: str,
) -> Optional[str]:
    profile = get_or_create_profile(db, user_id)
    field_name = assign_profile_media_url(profile, media_type, secure_url)
    db.add(profile)
    return field_name
