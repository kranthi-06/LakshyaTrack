from sqlalchemy import Boolean, Column, String, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.base_class import Base

# SQLite compatibility
def _is_sqlite():
    try:
        from app.core.config import settings
        return "sqlite" in str(settings.DATABASE_URL)
    except:
        return True

ID_TYPE = Integer if _is_sqlite() else None
if not _is_sqlite():
    from sqlalchemy.dialects.postgresql import UUID
    ID_TYPE = UUID(as_uuid=True)

class OTP(Base):
    __tablename__ = "otps"
    id = Column(ID_TYPE, primary_key=True, autoincrement="auto" if _is_sqlite() else None, default=None if _is_sqlite() else None)
    email = Column(String, index=True, nullable=False)
    hashed_otp = Column(String, nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    user_data = Column(JSON if _is_sqlite() else None, nullable=True) # Store temporary registration data
