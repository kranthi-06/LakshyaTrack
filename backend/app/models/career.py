"""
New models for the advanced career intelligence platform.
These are ADDITIVE — no existing tables are modified.
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.db.base_class import Base


class Roadmap(Base):
    """
    A personalized skill roadmap generated for a user based on their
    resume analysis, target role, and skill gaps.
    """
    __tablename__ = "roadmaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_role = Column(String, nullable=False)
    topic_name = Column(String, nullable=True)        # User-entered topic/skill (for custom roadmaps)
    current_skills = Column(JSONB, default=list)       # ["Python", "React", ...]
    skill_gaps = Column(JSONB, default=list)            # ["Docker", "K8s", ...]
    roadmap_data = Column(JSONB, nullable=False)      # Full roadmap structure (see below)
    # roadmap_data schema:
    # {
    #   "levels": [
    #     {
    #       "name": "Beginner",
    #       "pass_threshold": 70,
    #       "skills": [
    #         {
    #           "id": "skill-uuid",
    #           "name": "HTML & CSS",
    #           "status": "unlocked" | "locked" | "completed",
    #           "prerequisites": [],
    #           "learning_resources": [...],
    #           "order": 1
    #         }
    #       ]
    #     }
    #   ]
    # }
    is_active = Column(Boolean, default=True)
    last_opened = Column(DateTime(timezone=True), server_default=func.now())  # When the user last opened this roadmap
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class QuizAttempt(Base):
    """
    Records each quiz attempt a user makes for a specific skill in a roadmap.
    Used for gating progression.
    """
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    roadmap_id = Column(UUID(as_uuid=True), ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=True)
    skill_id = Column(String, nullable=False)         # Matches skill.id in roadmap_data
    skill_name = Column(String, nullable=False)
    level = Column(String, nullable=False)             # "Beginner", "Intermediate", "Advanced"
    score = Column(Float, nullable=False)              # 0.0 - 100.0
    passed = Column(Boolean, nullable=False)
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, nullable=False)
    questions_data = Column(JSONB, default=list)          # Full Q&A for review
    violation_flag = Column(Boolean, default=False)      # True if exam was terminated due to violations
    terminated = Column(Boolean, default=False)          # True if exam was force-terminated
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())


class ExamViolation(Base):
    """
    Tracks exam rule violations per user for the proctored exam system.
    Used to enforce escalating penalty timelines.
    """
    __tablename__ = "exam_violations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    violation_type = Column(String, nullable=False)     # "tab_switch", "fullscreen_exit", "refresh", "terminated"
    exam_topic = Column(String, nullable=True)
    exam_difficulty = Column(String, nullable=True)
    penalty_hours = Column(Float, default=1.0)          # Hours locked after this violation
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InterviewSession(Base):
    """
    Records a mock interview session result for a user.
    Unlocked only when all skills in a roadmap level are completed.
    """
    __tablename__ = "interview_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    roadmap_id = Column(UUID(as_uuid=True), ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=True)
    level = Column(String, nullable=True)              # Which level triggered this interview
    position = Column(String, nullable=False)
    round_type = Column(String, nullable=False)
    responses = Column(JSONB, default=list)               # [{question, answer}, ...]
    analysis = Column(JSONB, default=dict)                # AI feedback result
    technical_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    verdict = Column(String, nullable=True)
    completed_at = Column(DateTime(timezone=True), server_default=func.now())


class MultiStageInterview(Base):
    """
    Records a multi-stage hiring-simulation interview.
    Stages: screening → technical → coding → hr
    """
    __tablename__ = "multistage_interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(String, nullable=False)
    interview_mode = Column(String, default="resume_screening")  # resume_screening | direct_skill
    difficulty = Column(String, default="intermediate")

    # Per-stage scores (0-100)
    screening_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    coding_score = Column(Float, nullable=True)
    hr_score = Column(Float, nullable=True)
    overall_score = Column(Float, nullable=True)

    # Stage data (questions, answers, feedback per stage)
    screening_data = Column(JSONB, default=dict)
    technical_data = Column(JSONB, default=dict)
    coding_data = Column(JSONB, default=dict)
    hr_data = Column(JSONB, default=dict)

    # AI summary feedback
    strengths = Column(JSONB, default=list)
    weaknesses = Column(JSONB, default=list)
    overall_feedback = Column(Text, nullable=True)
    verdict = Column(String, nullable=True)

    # Status tracking
    current_stage = Column(String, default="screening")  # screening | technical | coding | hr | completed
    is_completed = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class Opportunity(Base):
    """
    Aggregated opportunities (courses, internships, jobs, certifications)
    from allowed public sources.
    Matched to user roadmaps and skill levels.
    """
    __tablename__ = "opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    company = Column(String, nullable=True)              # Provider / company name
    opportunity_type = Column(String, nullable=False)    # "job", "internship", "course", "certification"
    category = Column(String, nullable=True)             # Portal section: course|internship|certification|job
    description = Column(Text, nullable=True)
    url = Column(String, nullable=False)
    source = Column(String, nullable=True)               # "coursera", "udemy", "github_jobs", etc.
    skill_tags = Column(JSONB, default=list)               # ["Python", "React", ...]
    level = Column(String, nullable=True)                # "Beginner", "Intermediate", "Advanced"
    deadline = Column(DateTime(timezone=True), nullable=True)
    is_expired = Column(Boolean, default=False)
    location = Column(String, nullable=True)
    salary_range = Column(String, nullable=True)
    provider = Column(String, nullable=True)             # Explicit provider name
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProgressSnapshot(Base):
    """
    Periodic snapshots of a user's career readiness metrics.
    Used to render growth charts on the Progress page.
    """
    __tablename__ = "progress_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    career_readiness_score = Column(Float, default=0.0)
    resume_ats_score = Column(Float, default=0.0)
    skill_completion_pct = Column(Float, default=0.0)
    quiz_avg_score = Column(Float, default=0.0)
    interview_avg_score = Column(Float, default=0.0)
    total_skills_completed = Column(Integer, default=0)
    total_quizzes_passed = Column(Integer, default=0)
    total_interviews_done = Column(Integer, default=0)
    breakdown = Column(JSONB, default=dict)                # Detailed per-skill breakdown
    snapshot_date = Column(DateTime(timezone=True), server_default=func.now())


class LearningCache(Base):
    """
    Caches AI-generated learning resource suggestions to avoid repeated API calls.
    """
    __tablename__ = "learning_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_name = Column(String, nullable=False, index=True)
    level = Column(String, nullable=True)
    resources = Column(JSONB, default=list)               # [{title, url, type, order}, ...]
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('skill_name', 'level', name='uq_learning_cache_skill_level'),
    )
