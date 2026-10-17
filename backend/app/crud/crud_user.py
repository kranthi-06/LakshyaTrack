from typing import Optional, Union

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


def get_user(db: Session, user_id: Union[UUID, int, str]):
    """Fetch user by ID with profile eager-loaded (avoids N+1 on /users/me).

    Supports both UUID (PostgreSQL) and Integer (SQLite) IDs.
    """
    # Try to convert to int first (SQLite), then UUID (PostgreSQL)
    try:
        int_id = int(user_id)
        return (
            db.query(User)
            .options(joinedload(User.profile))
            .filter(User.id == int_id)
            .first()
        )
    except (ValueError, TypeError):
        pass

    # Try UUID
    try:
        uuid_id = UUID(str(user_id))
        return (
            db.query(User)
            .options(joinedload(User.profile))
            .filter(User.id == uuid_id)
            .first()
        )
    except (ValueError, TypeError):
        pass

    return None

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
