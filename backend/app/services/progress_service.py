"""
AI-Driven Progress Tracking Service — calculates Career Readiness Score,
maintains historical snapshots for growth charts.
"""
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from app.models.career import (
    Roadmap, QuizAttempt, InterviewSession, ProgressSnapshot
)
from app.services import document_store_service

logger = logging.getLogger(__name__)


def calculate_career_readiness(
    user_id: str,
    db: Session,
    resume_ats_score: float = 0.0
) -> dict:
    """
    Calculate the Career Readiness Score using:
    - Resume ATS score (passed in or from latest analysis)
    - Skill completion % from active roadmap
    - Quiz performance
    - Interview results
    
    Weights:
    - Resume ATS: 25%
    - Skill Completion: 30%
    - Quiz Performance: 25%
    - Interview Results: 20%
    """
    # 1. Skill completion from active roadmap
    skill_completion_pct = 0.0
    total_skills = 0
    completed_skills = 0

    roadmap = db.query(Roadmap).filter(
        Roadmap.user_id == user_id,
        Roadmap.is_active == True
    ).order_by(Roadmap.created_at.desc()).first()

    if roadmap and roadmap.roadmap_data:
        for level in roadmap.roadmap_data.get("levels", []):
            for skill in level.get("skills", []):
                total_skills += 1
                if skill.get("status") == "completed":
                    completed_skills += 1
        if total_skills > 0:
            skill_completion_pct = (completed_skills / total_skills) * 100

    # 2. Quiz average score
    quiz_avg = 0.0
    quiz_count = 0
    quizzes = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == user_id
    ).all()
    if quizzes:
        quiz_avg = sum(q.score for q in quizzes) / len(quizzes)
        quiz_count = len(quizzes)

    quizzes_passed = sum(1 for q in quizzes if q.passed)

    # 3. Interview average score
    interview_avg = 0.0
    interview_count = 0
    interviews = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id
    ).all()
    if interviews:
        scores = []
        for i in interviews:
            if i.technical_score is not None:
                scores.append(i.technical_score)
        if scores:
            interview_avg = sum(scores) / len(scores)
        interview_count = len(interviews)

    # 4. Weighted Career Readiness Score
    career_readiness = (
        (resume_ats_score * 0.25) +
        (skill_completion_pct * 0.30) +
        (quiz_avg * 0.25) +
        (interview_avg * 0.20)
    )

    result = {
        "career_readiness_score": round(career_readiness, 1),
        "resume_ats_score": round(resume_ats_score, 1),
        "skill_completion_pct": round(skill_completion_pct, 1),
        "quiz_avg_score": round(quiz_avg, 1),
        "interview_avg_score": round(interview_avg, 1),
        "total_skills": total_skills,
        "completed_skills": completed_skills,
        "total_quizzes": quiz_count,
        "quizzes_passed": quizzes_passed,
        "total_interviews": interview_count,
        "target_role": roadmap.target_role if roadmap else None
    }

    return result


def save_progress_snapshot(
    user_id: str,
    db: Session,
    resume_ats_score: float = 0.0
) -> dict:
    """
    Calculate and save a progress snapshot.
    Called periodically or after significant actions.
    """
    metrics = calculate_career_readiness(user_id, db, resume_ats_score)

    snapshot = ProgressSnapshot(
        user_id=user_id,
        career_readiness_score=metrics["career_readiness_score"],
        resume_ats_score=metrics["resume_ats_score"],
        skill_completion_pct=metrics["skill_completion_pct"],
        quiz_avg_score=metrics["quiz_avg_score"],
        interview_avg_score=metrics["interview_avg_score"],
        total_skills_completed=metrics["completed_skills"],
        total_quizzes_passed=metrics["quizzes_passed"],
        total_interviews_done=metrics["total_interviews"],
        breakdown=metrics
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    progress_payload = {
        "career_readiness_score": metrics["career_readiness_score"],
        "resume_ats_score": metrics["resume_ats_score"],
        "skill_completion_pct": metrics["skill_completion_pct"],
        "quiz_avg_score": metrics["quiz_avg_score"],
        "interview_avg_score": metrics["interview_avg_score"],
        "total_skills": metrics["total_skills"],
        "completed_skills": metrics["completed_skills"],
        "total_quizzes": metrics["total_quizzes"],
        "quizzes_passed": metrics["quizzes_passed"],
        "total_interviews": metrics["total_interviews"],
        "target_role": metrics["target_role"],
        "snapshot_date": snapshot.snapshot_date,
    }
    document_store_service.record_user_progress(
        user_id=user_id,
        snapshot_id=str(snapshot.id),
        progress_data=progress_payload,
    )
    document_store_service.record_task_log(
        task_name="progress_snapshot",
        status="success",
        source="api",
        user_id=user_id,
        details={
            "snapshot_id": str(snapshot.id),
            "career_readiness_score": metrics["career_readiness_score"],
        },
    )

    return {
        "snapshot_id": str(snapshot.id),
        **metrics,
        "snapshot_date": str(snapshot.snapshot_date)
    }


def get_progress_history(
    user_id: str,
    db: Session,
    limit: int = 30
) -> List[dict]:
    """Get historical progress snapshots for growth charts."""
    snapshots = db.query(ProgressSnapshot).filter(
        ProgressSnapshot.user_id == user_id
    ).order_by(ProgressSnapshot.snapshot_date.desc()).limit(limit).all()

    return [
        {
            "id": str(s.id),
            "career_readiness_score": s.career_readiness_score,
            "resume_ats_score": s.resume_ats_score,
            "skill_completion_pct": s.skill_completion_pct,
            "quiz_avg_score": s.quiz_avg_score,
            "interview_avg_score": s.interview_avg_score,
            "total_skills_completed": s.total_skills_completed,
            "total_quizzes_passed": s.total_quizzes_passed,
            "total_interviews_done": s.total_interviews_done,
            "snapshot_date": str(s.snapshot_date)
        }
        for s in reversed(snapshots)  # Oldest first for charts
    ]


def delete_progress_snapshot(
    user_id: str,
    db: Session,
    snapshot_id: str,
) -> bool:
    """
    Delete a single snapshot owned by the current user.
    Returns True if deleted, False if not found.
    """
    import uuid

    try:
        snapshot_uuid = uuid.UUID(str(snapshot_id))
    except Exception:
        return False

    snap = db.query(ProgressSnapshot).filter(
        ProgressSnapshot.id == snapshot_uuid,
        ProgressSnapshot.user_id == user_id,
    ).first()
    if not snap:
        return False

    db.delete(snap)
    db.commit()
    return True
