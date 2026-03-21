from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.services import interview_service
from pydantic import BaseModel, Field

router = APIRouter()

class QuestionRequest(BaseModel):
    position: str = "Software Engineer"
    round_type: str = "technical"
    history: List[Dict[str, Any]] = Field(default_factory=list)

class FinishRequest(BaseModel):
    position: str
    responses: Dict[str, List[Dict[str, Any]]]

@router.post("/next-question")
async def get_next_question(
    request: QuestionRequest,
    current_user = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Generate the next interview question.
    """
    question = await interview_service.generate_interview_question(
        request.position, request.round_type, request.history
    )
    return {"question": question}

@router.post("/analyze")
async def analyze_interview(
    request: FinishRequest,
    current_user = Depends(deps.get_current_user_optional),
) -> Any:
    """
    Analyze the full interview performance.
    """
    analysis = await interview_service.analyze_interview_performance(
        request.position, request.responses
    )
    return {"analysis": analysis}
