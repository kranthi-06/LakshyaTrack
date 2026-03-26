"""
Progress Intelligence System — Database Models
Isolated models for the Progress Intelligence Dashboard.
These tables are created separately and do NOT modify existing models.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
    ForeignKey, JSON, Text, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base


class DailyContribution(Base):
    """Tracks daily user activity/contributions for the heatmap."""
    __tablename__ = "pi_daily_contributions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False)
    count = Column(Integer, default=0, nullable=False)
    activities = Column(JSON, default=list)  # List of activity types performed
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_pi_contribution_user_date'),
        Index('ix_pi_contribution_user_date', 'user_id', 'date'),
    )


class ProblemStat(Base):
    """Tracks problem-solving statistics per user."""
    __tablename__ = "pi_problem_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    problem_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)  # easy, medium, hard
    status = Column(String, nullable=False)       # accepted, wrong_answer, time_limit, runtime_error
    language = Column(String, nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)
    topic = Column(String, nullable=True)
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index('ix_pi_problem_user_difficulty', 'user_id', 'difficulty'),
    )


class ActivityLog(Base):
    """Structured activity event logs for tracking."""
    __tablename__ = "pi_activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)  # login, logout, page_visit, feature_use, etc.
    event_metadata = Column("metadata", JSON, default=dict)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    session_id = Column(String, nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index('ix_pi_activity_user_type', 'user_id', 'event_type'),
        Index('ix_pi_activity_user_time', 'user_id', 'timestamp'),
    )


class UserSession(Base):
    """Tracks user sessions with login/logout and duration."""
    __tablename__ = "pi_user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    session_token = Column(String, nullable=True, unique=True)
    login_time = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    logout_time = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Float, nullable=True)
    active_minutes = Column(Float, nullable=True)
    idle_minutes = Column(Float, nullable=True)
    pages_visited = Column(JSON, default=list)
    features_used = Column(JSON, default=list)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index('ix_pi_session_user_active', 'user_id', 'is_active'),
    )


class TopicStat(Base):
    """Tracks per-topic/skill statistics."""
    __tablename__ = "pi_topic_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    topic_name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # DSA, Web, AI/ML, etc.
    problems_solved = Column(Integer, default=0)
    time_spent_minutes = Column(Float, default=0)
    proficiency_score = Column(Float, default=0)  # 0-100
    last_practiced = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('user_id', 'topic_name', name='uq_pi_topic_user_topic'),
        Index('ix_pi_topic_user_category', 'user_id', 'category'),
    )


class UserBadge(Base):
    """Tracks badge/achievement unlock status per user."""
    __tablename__ = "pi_user_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    badge_id = Column(String, nullable=False)
    badge_name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # streak, problems, consistency, mastery, special
    rarity = Column(String, nullable=False)     # common, rare, epic, legendary
    is_unlocked = Column(Boolean, default=False)
    unlocked_at = Column(DateTime(timezone=True), nullable=True)
    progress = Column(Float, default=0)  # 0-100
    current_value = Column(Float, default=0)
    requirement_value = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'badge_id', name='uq_pi_badge_user_badge'),
    )


class UserStreak(Base):
    """Enhanced streak tracking with history."""
    __tablename__ = "pi_user_streaks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, unique=True, index=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_active_date = Column(Date, nullable=True)
    total_active_days = Column(Integer, default=0)
    streak_history = Column(JSON, default=list)  # Last 90 days history
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
