"""
Exam Proctoring API Endpoints — Secure Examination System

Routes:
  POST /exam/record-violation     — Record an exam rule violation
  GET  /exam/check-eligibility    — Check if user can take exams
  GET  /exam/cooldown/{skill_id}  — Check failure cooldown for a skill
  GET  /exam/violation-history    — Get user's violation history
"""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.services import exam_proctoring_service

router = APIRouter()


class ViolationRequest(BaseModel):
    violation_type: str   # "tab_switch", "fullscreen_exit", "refresh", "terminated"
    exam_topic: Optional[str] = None
    exam_difficulty: Optional[str] = None


@router.post("/record-violation")
def record_violation(
    data: ViolationRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Record an exam violation and return the penalty details."""
    result = exam_proctoring_service.record_violation(
        user_id=str(current_user.id),
        violation_type=data.violation_type,
        db=db,
        exam_topic=data.exam_topic,
        exam_difficulty=data.exam_difficulty,
    )
    return result


@router.get("/check-eligibility")
def check_eligibility(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Check if the current user is eligible to take an exam."""
    return exam_proctoring_service.check_exam_eligibility(
        user_id=str(current_user.id),
        db=db,
    )


@router.get("/cooldown/{skill_id}")
def check_cooldown(
    skill_id: str,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Check if the user is in a failure cooldown for a specific skill."""
    return exam_proctoring_service.get_failure_cooldown(
        user_id=str(current_user.id),
        skill_id=skill_id,
        db=db,
    )


@router.get("/violation-history")
def violation_history(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get the current user's violation history."""
    history = exam_proctoring_service.get_violation_history(
        user_id=str(current_user.id),
        db=db,
    )
    return {"violations": history}
