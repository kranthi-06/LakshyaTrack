from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.user import User, Profile
from app.schemas.user import UserCreate, UserUpdate
from uuid import UUID
from app.core.security import get_password_hash

def normalize_email(email: Optional[str]) -> Optional[str]:
    if email is None:
        return None
    normalized = email.strip().lower()
    return normalized or None


def get_user(db: Session, user_id: UUID):
    """Fetch user by ID with profile eager-loaded (avoids N+1 on /users/me)."""
    return (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.id == user_id)
        .first()
    )

def get_user_by_email(db: Session, email: str):
    """Fetch user by email with profile eager-loaded.
    
    Note: emails are stored lowercase via normalize_email() at insert time,
    so we can compare directly without func.lower() — this allows PostgreSQL
    to use the index on users.email.
    """
    normalized_email = normalize_email(email)
    if not normalized_email:
        return None
    return (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.email == normalized_email)
        .first()
    )


def create_user(db: Session, user_in: UserCreate):
    db_user = User(
        email=normalize_email(user_in.email),
        login_type=user_in.login_type,
        hashed_password=get_password_hash(user_in.password),
        is_active=user_in.is_active,
        is_verified=False, # Default to False, must verify via OTP
        is_superuser=user_in.is_superuser,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
