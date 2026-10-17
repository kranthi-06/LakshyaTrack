"""
Exam Proctoring API Endpoints — Secure Examination System

Routes:
  POST /exam/record-violation     — Record an exam rule violation
  GET  /exam/check-eligibility    — Check if user can take exams
  GET  /exam/cooldown/{skill_id}  — Check failure cooldown for a skill
  GET  /exam/violation-history    — Get user's violation history
"""
import json
from typing import Any, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from app.api import deps
from app.models.career import ExamEvent
from app.services import exam_proctoring_service

router = APIRouter()


class ViolationRequest(BaseModel):
    violation_type: Literal["tab_switch", "fullscreen_exit", "refresh", "terminated"]
    exam_topic: Optional[str] = None
    exam_difficulty: Optional[str] = None


class ExamEventPayload(BaseModel):
    client_event_id: str = Field(min_length=1, max_length=120)
    event_type: Literal[
        "focus_lost",
        "restricted_shortcut",
        "network_offline",
        "network_online",
    ]
    details: dict[str, Any] = Field(default_factory=dict)
    exam_topic: Optional[str] = Field(default=None, max_length=200)
    exam_difficulty: Optional[str] = Field(default=None, max_length=50)

    @field_validator("details")
    @classmethod
    def details_are_size_capped(cls, value: dict[str, Any]) -> dict[str, Any]:
        serialized = json.dumps(value, separators=(",", ":"), default=str, ensure_ascii=False)
        if len(serialized.encode("utf-8")) > 2048:
            raise ValueError("event details exceed 2048 bytes")
        return value


class ExamEventsRequest(BaseModel):
    events: list[ExamEventPayload] = Field(min_length=1, max_length=50)


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


@router.post("/events")
def record_events(
    data: ExamEventsRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    accepted = 0
    duplicates = 0
    user_id = current_user.id
    seen_client_event_ids: set[str] = set()
    for event in data.events:
        if event.client_event_id in seen_client_event_ids:
            duplicates += 1
            continue
        seen_client_event_ids.add(event.client_event_id)
        existing = (
            db.query(ExamEvent)
            .filter(
                ExamEvent.user_id == user_id,
                ExamEvent.client_event_id == event.client_event_id,
            )
            .first()
        )
        if existing:
            duplicates += 1
            continue
        db.add(ExamEvent(
            user_id=user_id,
            client_event_id=event.client_event_id,
            event_type=event.event_type,
            details=event.details,
            exam_topic=event.exam_topic,
            exam_difficulty=event.exam_difficulty,
        ))
        accepted += 1
    db.commit()
    return {"accepted": accepted, "duplicates": duplicates}


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
