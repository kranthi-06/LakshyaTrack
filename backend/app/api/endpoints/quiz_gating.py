"""
API Endpoints for the Quiz Gating System.
Extends the existing Quiz page with roadmap-linked quiz functionality.
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.services import quiz_gating_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class SkillQuizRequest(BaseModel):
    skill_name: str
    level: str  # "Beginner", "Intermediate", "Advanced"
    count: int = 10


class QuizSubmission(BaseModel):
    roadmap_id: Optional[str] = None
    skill_id: str
    skill_name: str
    level: str
    answers: List[dict]  # [{question_id, selected, correct, question_text}]


@router.post("/generate-skill-quiz")
async def generate_skill_quiz(
    request: SkillQuizRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a quiz for a specific roadmap skill at the correct difficulty."""
    try:
        if request.count < 1 or request.count > 30:
            request.count = 10

        questions = await quiz_gating_service.generate_skill_quiz(
            skill_name=request.skill_name,
            level=request.level,
            count=request.count
        )

        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate quiz questions")

        return {"questions": questions, "threshold": quiz_gating_service.PASS_THRESHOLDS.get(request.level, 70)}

    except Exception as e:
        logger.exception("Failed to generate skill quiz: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to generate skill quiz")


@router.post("/submit")
async def submit_quiz(
    request: QuizSubmission,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Submit a quiz attempt. Grades it and updates roadmap if passed."""
    try:
        result = quiz_gating_service.submit_quiz_attempt(
            user_id=str(current_user.id),
            roadmap_id=request.roadmap_id,
            skill_id=request.skill_id,
            skill_name=request.skill_name,
            level=request.level,
            answers=request.answers,
            db=db
        )
        return result
    except Exception as e:
        logger.exception("Failed to submit quiz attempt: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to submit quiz attempt")


@router.get("/history")
async def get_quiz_history(
    skill_id: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get quiz attempt history for the current user."""
    history = quiz_gating_service.get_quiz_history(
        user_id=str(current_user.id),
        db=db,
        skill_id=skill_id
    )
    return {"attempts": history}


@router.get("/check-passed/{skill_id}")
async def check_passed(
    skill_id: str,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Check if the user has passed the quiz for a specific skill."""
    passed = quiz_gating_service.has_passed_skill_quiz(
        user_id=str(current_user.id),
        skill_id=skill_id,
        db=db
    )
    return {"passed": passed}
