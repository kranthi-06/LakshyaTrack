from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

class SavedResume(Base):
    __tablename__ = "saved_resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resume_name = Column(String, default="Untitled Resume")
    resume_url = Column(String, nullable=True)
    resume_data = Column(JSONB, nullable=False)
    template_id = Column(String, default="modern")
    theme = Column(String, default="default")
    target_role = Column(String, nullable=True)
    ats_score = Column(Float, nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="resumes")
