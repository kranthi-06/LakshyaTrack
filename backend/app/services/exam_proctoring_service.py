"""
Exam Proctoring Service — manages violation tracking, penalty lockouts,
and failure cooldowns for the secure exam system.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from app.models.career import ExamViolation, QuizAttempt

logger = logging.getLogger(__name__)

# ── Escalating penalty hours per cumulative violation ──────
VIOLATION_PENALTIES = {
    1: 1,     # 1st violation → 1 hour
    2: 5,     # 2nd → 5 hours
    3: 10,    # 3rd → 10 hours
    4: 12,    # 4th → 12 hours
}
MAX_PENALTY_HOURS = 24  # 5th+ → 24 hours

# ── Failure cooldown minutes (consecutive fails on same topic) ──
FAILURE_COOLDOWNS = {
    1: 3,     # 1st failure → 3 min
    2: 5,     # 2nd → 5 min
    3: 9,     # 3rd → 9 min
}
MAX_FAILURE_COOLDOWN = 13  # 4th+ → 13 min (max)


def get_violation_count(user_id: str, db: Session) -> int:
    """Get total number of exam violations for a user."""
    return db.query(ExamViolation).filter(
        ExamViolation.user_id == user_id
    ).count()


def get_penalty_hours(violation_number: int) -> float:
    """Calculate penalty hours based on violation number."""
    if violation_number in VIOLATION_PENALTIES:
        return VIOLATION_PENALTIES[violation_number]
    return MAX_PENALTY_HOURS


def record_violation(
    user_id: str,
    violation_type: str,
    db: Session,
    exam_topic: str = None,
    exam_difficulty: str = None,
) -> dict:
    """
    Record an exam violation and compute the lockout period.
    Returns the violation record and lockout info.
    """
    current_count = get_violation_count(user_id, db)
    new_count = current_count + 1
    penalty_hours = get_penalty_hours(new_count)
    locked_until = datetime.now(timezone.utc) + timedelta(hours=penalty_hours)

    violation = ExamViolation(
        user_id=user_id,
        violation_type=violation_type,
        exam_topic=exam_topic,
        exam_difficulty=exam_difficulty,
        penalty_hours=penalty_hours,
        locked_until=locked_until,
    )
    db.add(violation)
    db.commit()
    db.refresh(violation)

    logger.info(
        f"Exam violation #{new_count} recorded for user {user_id}: "
        f"{violation_type} → locked for {penalty_hours}h until {locked_until}"
    )

    return {
        "violation_id": str(violation.id),
        "violation_number": new_count,
        "violation_type": violation_type,
        "penalty_hours": penalty_hours,
        "locked_until": locked_until.isoformat(),
    }


def check_exam_eligibility(user_id: str, db: Session) -> dict:
    """
    Check if a user is eligible to take an exam.
    Returns eligibility status and lockout details if locked.
    """
    # Find the most recent violation with a future locked_until
    latest_violation = (
        db.query(ExamViolation)
        .filter(
            ExamViolation.user_id == user_id,
            ExamViolation.locked_until > datetime.now(timezone.utc),
        )
        .order_by(ExamViolation.locked_until.desc())
        .first()
    )

    if latest_violation:
        remaining = latest_violation.locked_until - datetime.now(timezone.utc)
        remaining_seconds = max(0, int(remaining.total_seconds()))
        return {
            "eligible": False,
            "locked_until": latest_violation.locked_until.isoformat(),
            "remaining_seconds": remaining_seconds,
            "penalty_hours": latest_violation.penalty_hours,
            "violation_count": get_violation_count(user_id, db),
            "reason": f"Quizzes locked for {latest_violation.penalty_hours} hours due to exam rule violations.",
        }

    return {
        "eligible": True,
        "violation_count": get_violation_count(user_id, db),
    }


def get_failure_cooldown(user_id: str, skill_id: str, db: Session) -> dict:
    """
    Check if the user is in a cooldown period after failing a quiz.
    Computes based on consecutive recent failures for the same skill.
    """
    # Get recent failed attempts for this skill, ordered most recent first
    recent_failures = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.skill_id == skill_id,
            QuizAttempt.passed == False,
        )
        .order_by(QuizAttempt.attempted_at.desc())
        .limit(10)
        .all()
    )

    if not recent_failures:
        return {"in_cooldown": False, "consecutive_failures": 0}

    # Check if user has passed since last failure (resets cooldown)
    last_pass = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.skill_id == skill_id,
            QuizAttempt.passed == True,
        )
        .order_by(QuizAttempt.attempted_at.desc())
        .first()
    )

    # Count consecutive failures since last pass
    consecutive = 0
    for fail in recent_failures:
        if last_pass and fail.attempted_at < last_pass.attempted_at:
            break
        consecutive += 1

    if consecutive == 0:
        return {"in_cooldown": False, "consecutive_failures": 0}

    # Calculate cooldown minutes
    if consecutive in FAILURE_COOLDOWNS:
        cooldown_minutes = FAILURE_COOLDOWNS[consecutive]
    else:
        cooldown_minutes = MAX_FAILURE_COOLDOWN

    # Check if cooldown has expired
    last_failure_time = recent_failures[0].attempted_at
    if last_failure_time.tzinfo is None:
        from datetime import timezone as tz
        last_failure_time = last_failure_time.replace(tzinfo=tz.utc)

    cooldown_until = last_failure_time + timedelta(minutes=cooldown_minutes)
    now = datetime.now(timezone.utc)

    if now < cooldown_until:
        remaining = cooldown_until - now
        return {
            "in_cooldown": True,
            "consecutive_failures": consecutive,
            "cooldown_minutes": cooldown_minutes,
            "cooldown_until": cooldown_until.isoformat(),
            "remaining_seconds": max(0, int(remaining.total_seconds())),
        }

    return {
        "in_cooldown": False,
        "consecutive_failures": consecutive,
    }


def get_violation_history(user_id: str, db: Session, limit: int = 20) -> List[dict]:
    """Get violation history for a user."""
    violations = (
        db.query(ExamViolation)
        .filter(ExamViolation.user_id == user_id)
        .order_by(ExamViolation.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(v.id),
            "violation_type": v.violation_type,
            "exam_topic": v.exam_topic,
            "penalty_hours": v.penalty_hours,
            "locked_until": v.locked_until.isoformat() if v.locked_until else None,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in violations
    ]
