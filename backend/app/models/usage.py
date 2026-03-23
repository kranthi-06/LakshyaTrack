"""
Usage Tracking Model — tracks per-user resource consumption for plan-based limits.

Fields track:
- Resume storage count
- Weekly interview practice count
- Plan maker usage count
- Monthly resume edit count
- Timestamps for auto-reset (weekly + monthly)
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class UserUsage(Base):
    """
    Per-user usage counters — enforced by backend middleware.
    Created automatically on first usage check (lazy initialization).
    """
    __tablename__ = "user_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Counters ────────────────────────────────────────────────
    resume_count = Column(Integer, default=0, nullable=False)
    interview_count_weekly = Column(Integer, default=0, nullable=False)
    plan_count = Column(Integer, default=0, nullable=False)
    resume_edit_monthly = Column(Integer, default=0, nullable=False)

    # ── Reset timestamps ────────────────────────────────────────
    last_reset_weekly = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_reset_monthly = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Metadata ────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship back to User
    user = relationship("User", backref="usage", uselist=False)

    def __repr__(self) -> str:
        return (
            f"<UserUsage user_id={self.user_id} "
            f"resumes={self.resume_count} "
            f"interviews_weekly={self.interview_count_weekly} "
            f"plans={self.plan_count} "
            f"edits_monthly={self.resume_edit_monthly}>"
        )
