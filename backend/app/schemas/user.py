from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[Union[str, int]] = None  # Support both UUID (PostgreSQL) and Integer (SQLite)

class ProfileBase(BaseModel):
    full_name: Optional[str] = None
    profile_photo_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    resume_url: Optional[str] = None
    certificate_url: Optional[str] = None
    project_image_url: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    links: Optional[Dict[str, Any]] = {}
    skills: Optional[List[str]] = []
    activity_log: Optional[List[Dict[str, Any]]] = []

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(ProfileBase):
    pass

class Profile(ProfileBase):
    id: Union[str, int]  # Support both UUID (PostgreSQL) and Integer (SQLite)
    role: Optional[str] = 'user'
    is_blacklisted: Optional[bool] = False
    last_active_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr
    login_type: Optional[str] = 'custom'
    is_active: Optional[bool] = True
    is_superuser: bool = False

class UserCreate(UserBase):
    password: str
    full_name: Optional[str] = None

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: Union[str, int, None] = None  # Support both UUID (PostgreSQL) and Integer (SQLite)
    role: Optional[str] = 'user'
    is_blacklisted: Optional[bool] = False
    last_active_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    profile: Optional[Profile] = None
    subscription_status: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class TokenWithUser(Token):
    user: Optional[User] = None

class UserInDB(UserInDBBase):
    pass

# ── Admin Schemas ──────────────────────────────────────────
class AdminUserView(BaseModel):
    id: Union[str, int]  # Support both UUID (PostgreSQL) and Integer (SQLite)
    email: str
    role: str
    is_active: bool
    is_blacklisted: bool
    last_active_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    profile: Optional[Profile] = None

    class Config:
        from_attributes = True

class BlacklistRequest(BaseModel):
    user_id: str
    reason: Optional[str] = "Blacklisted by admin"

class UnblacklistRequest(BaseModel):
    user_id: str

class PromoteRequest(BaseModel):
    user_id: str

class DemoteRequest(BaseModel):
    user_id: str

class DeleteUserRequest(BaseModel):
    user_id: str

class BlacklistRecord(BaseModel):
    user_id: Union[str, int]  # Support both UUID (PostgreSQL) and Integer (SQLite)
    email: str
    reason: Optional[str] = None
    blacklisted_at: Optional[datetime] = None
    blacklisted_by: Optional[Union[str, int]] = None

    class Config:
        from_attributes = True
