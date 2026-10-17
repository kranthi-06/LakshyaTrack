from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import sys

# SQLite compatibility: use Integer for ID instead of UUID
# We check at runtime, not import time
IS_SQLITE = None

def _is_sqlite():
    global IS_SQLITE
    if IS_SQLITE is None:
        try:
            from app.core.config import settings
            IS_SQLITE = "sqlite" in str(settings.DATABASE_URL)
        except:
            IS_SQLITE = True  # Default to SQLite if config fails
    return IS_SQLITE

if _is_sqlite():
    # SQLite uses INTEGER auto-increment for IDs
    ID_TYPE = Integer
else:
    from sqlalchemy.dialects.postgresql import UUID
    ID_TYPE = UUID(as_uuid=True)

class User(Base):
    __tablename__ = "users"
    id = Column(ID_TYPE, primary_key=True, autoincrement="auto" if _is_sqlite() else None)
    email = Column(String, unique=True, index=True, nullable=False)
    login_type = Column(String, default='custom')
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    hashed_password = Column(String, nullable=True) # Allow null for OAuth users if any
    is_superuser = Column(Boolean, default=False)
    
    # Admin System Fields
    role = Column(String, default='user', nullable=False)  # 'user', 'admin', 'black_admin'
    is_blacklisted = Column(Boolean, default=False, nullable=False)
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    resumes = relationship("SavedResume", back_populates="user", cascade="all, delete-orphan")

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(ID_TYPE, ForeignKey("users.id"), primary_key=True)
    full_name = Column(String, nullable=True)
    profile_photo_url = Column(String, nullable=True)  # URL or base64 for profile photo
    profile_image_url = Column(String, nullable=True)
    resume_url = Column(String, nullable=True)
    certificate_url = Column(String, nullable=True)
    project_image_url = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    links = Column(JSON if _is_sqlite() else JSONB, default=dict)
    skills = Column(JSON if _is_sqlite() else JSONB, default=list) # Array of extracted/manual skills
    activity_log = Column(JSON if _is_sqlite() else JSONB, default=list)
    
    # Mirror admin fields for easy profile queries
    role = Column(String, default='user', nullable=True)
    is_blacklisted = Column(Boolean, default=False, nullable=True)
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="profile")

class Blacklist(Base):
    __tablename__ = "blacklist"
    user_id = Column(ID_TYPE, ForeignKey("users.id"), primary_key=True)
    email = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    blacklisted_at = Column(DateTime(timezone=True), server_default=func.now())
    blacklisted_by = Column(ID_TYPE, nullable=True)
