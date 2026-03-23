"""
API Endpoints for Advanced AI Mock Interviews.
Extends the existing Interview page with roadmap-gated interviews.
"""
from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api import deps
from app.services import interview_advanced_service
from app.middleware.require_usage_limit import require_usage_limit
from app.services.usage_service import increment_usage
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class InterviewUnlockCheck(BaseModel):
    roadmap_id: str
    level_name: str


class AdvancedQuestionRequest(BaseModel):
    position: str = "Software Engineer"
    round_type: str = "technical"
    history: List[Dict[str, Any]] = Field(default_factory=list)
    resume_summary: Optional[str] = None
    target_skills: Optional[List[str]] = None


class AdvancedFinishRequest(BaseModel):
    roadmap_id: Optional[str] = None
    level: Optional[str] = None
    position: str
    round_type: str
    responses: List[Dict[str, Any]]  # [{question, answer}]
    resume_summary: Optional[str] = None


@router.post("/check-unlock")
async def check_interview_unlock(
    request: InterviewUnlockCheck,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Check if a mock interview is unlocked for a specific roadmap level."""
    result = interview_advanced_service.check_interview_unlock(
        user_id=str(current_user.id),
        roadmap_id=request.roadmap_id,
        level_name=request.level_name,
        db=db
    )
    return result


@router.post("/next-question-advanced")
async def get_next_question(
    request: AdvancedQuestionRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(require_usage_limit("interview_count_weekly")),
) -> Any:
    """Generate the next interview question. Enforces interview_count_weekly limit."""
    question = await interview_advanced_service.generate_interview_question_advanced(
        position=request.position,
        round_type=request.round_type,
        history=request.history,
        resume_summary=request.resume_summary,
        target_skills=request.target_skills
    )

    # Increment weekly interview counter
    increment_usage(db, current_user.id, "interview_count_weekly")

    return {"question": question}


@router.post("/finish-advanced")
async def finish_interview(
    request: AdvancedFinishRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Finish and analyze an interview session.
    Provides structured feedback and saves results.
    """
    try:
        # Get AI analysis
        analysis = await interview_advanced_service.analyze_interview_advanced(
            position=request.position,
            responses=request.responses,
            resume_summary=request.resume_summary
        )

        # Save the session
        result = interview_advanced_service.save_interview_session(
            user_id=str(current_user.id),
            roadmap_id=request.roadmap_id,
            level=request.level,
            position=request.position,
            round_type=request.round_type,
            responses=request.responses,
            analysis=analysis,
            db=db
        )

        return result
    except Exception as e:
        logger.exception("Advanced interview finalize failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to finalize interview")


@router.get("/history-advanced")
async def get_interview_history(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get all interview session history for the current user."""
    history = interview_advanced_service.get_interview_history(
        user_id=str(current_user.id),
        db=db
    )
    return {"sessions": history}
