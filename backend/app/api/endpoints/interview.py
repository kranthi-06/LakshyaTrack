from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.api.deps import _resolve_user_role
from app.api.endpoints import interview_multistage as multistage_endpoints
from app.services import interview_service
from pydantic import BaseModel, Field
from app.services.usage_service import LimitExceededError, consume_usage

router = APIRouter()

class QuestionRequest(BaseModel):
    position: str = "Software Engineer"
    round_type: str = "technical"
    history: List[Dict[str, Any]] = Field(default_factory=list)

class FinishRequest(BaseModel):
    position: str
    responses: Dict[str, List[Dict[str, Any]]]


class InterviewStartRequest(multistage_endpoints.CreateSessionRequest):
    pass

@router.post("/next-question")
async def get_next_question(
    request: QuestionRequest,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Generate the next interview question.
    """
    try:
        if not request.history:
            consume_usage(
                db,
                current_user.id,
                "weeklyInterviews",
                user_role=_resolve_user_role(current_user),
            )

        question = await interview_service.generate_interview_question(
            request.position, request.round_type, request.history
        )
        db.commit()
        return {"question": question}
    except LimitExceededError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.detail) from exc
    except Exception:
        db.rollback()
        raise

@router.post("/analyze")
async def analyze_interview(
    request: FinishRequest,
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Analyze the full interview performance.
    """
    analysis = await interview_service.analyze_interview_performance(
        request.position, request.responses
    )
    return {"analysis": analysis}


@router.post("/start")
async def start_interview(
    request: InterviewStartRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """SaaS alias for starting the multi-stage interview simulator."""
    return await multistage_endpoints.create_session(
        request=request,
        db=db,
        current_user=current_user,
    )


@router.get("/history")
async def interview_history(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """SaaS alias for interview history."""
    return await multistage_endpoints.get_history(
        db=db,
        current_user=current_user,
    )
