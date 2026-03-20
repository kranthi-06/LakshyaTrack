import uuid

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base_class import Base


class ReasoningQuestion(Base):
    __tablename__ = "reasoning_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic = Column(String(64), nullable=True, index=True)
    company = Column(String(64), nullable=True, index=True)
    difficulty = Column(String(20), nullable=False, default="medium")
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False, default=list)
    correct_answer = Column(String(1), nullable=False)
    explanation = Column(Text, nullable=False, default="")
    source = Column(String(32), nullable=False, default="ai_generated")
    question_hash = Column(String(32), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReasoningTest(Base):
    __tablename__ = "reasoning_tests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(128), nullable=False, index=True)
    test_type = Column(String(32), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    score = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    accuracy = Column(Float, nullable=False, default=0.0)
    answers = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReasoningUserProgress(Base):
    __tablename__ = "reasoning_user_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "topic", name="uq_reasoning_user_progress_user_topic"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(128), nullable=False, index=True)
    topic = Column(String(64), nullable=False, index=True)
    total_attempted = Column(Integer, nullable=False, default=0)
    correct = Column(Integer, nullable=False, default=0)
    wrong = Column(Integer, nullable=False, default=0)
    wrong_question_ids = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
