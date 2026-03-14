from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, UUID4
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[UUID4] = None

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
    id: UUID4
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
    id: Optional[UUID4] = None
    role: Optional[str] = 'user'
    is_blacklisted: Optional[bool] = False
    last_active_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    profile: Optional[Profile] = None

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    pass

# ── Admin Schemas ──────────────────────────────────────────
class AdminUserView(BaseModel):
    id: UUID4
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
    user_id: UUID4
    email: str
    reason: Optional[str] = None
    blacklisted_at: Optional[datetime] = None
    blacklisted_by: Optional[UUID4] = None
    
    class Config:
        from_attributes = True
