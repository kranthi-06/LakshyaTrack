from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from uuid import UUID
from app.core.security import get_password_hash

def get_user(db: Session, user_id: UUID):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    if not email:
        return None
    normalized_email = email.strip()
    return db.query(User).filter(User.email == normalized_email).first()


def create_user(db: Session, user_in: UserCreate):
    db_user = User(
        email=user_in.email,
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

