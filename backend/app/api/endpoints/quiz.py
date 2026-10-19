from typing import Any, List, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.api import deps
from app.services import quiz_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class QuizRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    count: int = Field(default=5, ge=1, le=30)

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct: int

@router.post("/generate", response_model=List[QuizQuestion])
async def generate_quiz(
    request: QuizRequest,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Generate dynamic quiz questions for an authenticated user.
    """
    try:
        questions = await quiz_service.generate_quiz(
            request.topic, request.difficulty, request.count
        )

        if not questions:
            raise HTTPException(
                status_code=503,
                detail="AI question generation is temporarily unavailable, please retry",
            )

        return questions
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Quiz generation failed: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="AI question generation is temporarily unavailable, please retry",
        )
