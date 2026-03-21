from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api import deps
from app.services import quiz_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class QuizRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"
    count: int = 5

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct: int

@router.post("/generate", response_model=List[QuizQuestion])
async def generate_quiz(
    request: QuizRequest,
    current_user = Depends(deps.get_current_user_optional), # Use optional auth
) -> Any:
    """
    Generate dynamic quiz questions.
    """
    try:
        # Validate count to prevent abuse
        if request.count < 1 or request.count > 30:
            request.count = 10
            
        questions = await quiz_service.generate_quiz(
            request.topic, request.difficulty, request.count
        )
        
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate questions")
            
        return questions
    except Exception as e:
        logger.exception("Quiz generation failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to generate quiz questions")
