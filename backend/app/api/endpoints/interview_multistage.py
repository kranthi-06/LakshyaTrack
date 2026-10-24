"""
API Endpoints for Multi-Stage AI Interview System.
Provides routes for the 4-stage hiring simulation.
"""
from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api import deps
from app.api.deps import _resolve_user_role
from app.services import interview_multistage_service
from app.services.usage_service import LimitExceededError, consume_usage
from app.models.career import MultiStageInterview

router = APIRouter()


# ─── Request Schemas ────────────────────────────────────

class CreateSessionRequest(BaseModel):
    position: str = Field(default="Software Engineer", min_length=2, max_length=160)
    interview_mode: str = "resume_screening"  # resume_screening | direct_skill
    difficulty: str = "intermediate"


class ScreeningQuestionRequest(BaseModel):
    session_id: str
    resume_summary: str = ""
    skills: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    history: List[Dict[str, Any]] = Field(default_factory=list)


class TechnicalQuestionRequest(BaseModel):
    session_id: str
    skills: List[str] = Field(default_factory=list)
    history: List[Dict[str, Any]] = Field(default_factory=list)


class CodingProblemRequest(BaseModel):
    session_id: str
    skills: List[str] = Field(default_factory=list)
    difficulty: str = "intermediate"


class HRQuestionRequest(BaseModel):
    session_id: str
    history: List[Dict[str, Any]] = Field(default_factory=list)


class EvaluateStageRequest(BaseModel):
    session_id: str
    stage: str  # screening | technical | coding | hr
    responses: List[Dict[str, Any]] = Field(default_factory=list)
    # For screening
    resume_summary: str = ""
    # For technical
    skills: List[str] = Field(default_factory=list)
    # For coding
    code: str = ""
    language: str = "python"
    problem: Dict[str, Any] = Field(default_factory=dict)
    passed_tests: int = 0
    total_tests: int = 0
    attempts: int = 1


class FinalAnalysisRequest(BaseModel):
    session_id: str
    screening_eval: Dict[str, Any] = Field(default_factory=dict)
    technical_eval: Dict[str, Any] = Field(default_factory=dict)
    coding_eval: Dict[str, Any] = Field(default_factory=dict)
    hr_eval: Dict[str, Any] = Field(default_factory=dict)


def _get_owned_session(session_id: str, user_id: str, db: Session) -> MultiStageInterview:
    """Fetch an interview only when it belongs to the authenticated candidate."""
    session = db.query(MultiStageInterview).filter(
        MultiStageInterview.id == session_id,
        MultiStageInterview.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")
    return session


# ─── Endpoints ──────────────────────────────────────────

@router.post("/create-session")
async def create_session(
    request: CreateSessionRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Create a new multi-stage interview session."""
    try:
        result = interview_multistage_service.create_interview_session(
            user_id=str(current_user.id),
            position=request.position,
            interview_mode=request.interview_mode,
            difficulty=request.difficulty,
            db=db,
            commit=False,
        )
        consume_usage(
            db,
            current_user.id,
            "weeklyInterviews",
            user_role=_resolve_user_role(current_user),
        )
        db.commit()
        return result
    except LimitExceededError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.detail) from exc
    except Exception:
        db.rollback()
        raise


@router.post("/screening-question")
async def get_screening_question(
    request: ScreeningQuestionRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a resume screening question."""
    session = _get_owned_session(request.session_id, str(current_user.id), db)
    if session.is_completed or session.current_stage != "screening":
        raise HTTPException(status_code=409, detail="The screening stage is no longer active")
    question = await interview_multistage_service.generate_screening_question(
        position=session.position,
        resume_summary=request.resume_summary,
        history=request.history,
        skills=request.skills,
        projects=request.projects,
    )
    return {"question": question}


@router.post("/technical-question")
async def get_technical_question(
    request: TechnicalQuestionRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a technical interview question."""
    session = _get_owned_session(request.session_id, str(current_user.id), db)
    if session.is_completed or session.current_stage != "technical":
        raise HTTPException(status_code=409, detail="The technical stage is not active")
    question = await interview_multistage_service.generate_technical_question(
        position=session.position,
        skills=request.skills,
        history=request.history,
    )
    return {"question": question}


@router.post("/coding-problem")
async def get_coding_problem(
    request: CodingProblemRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a coding problem with test cases."""
    session = _get_owned_session(request.session_id, str(current_user.id), db)
    if session.is_completed or session.current_stage != "coding":
        raise HTTPException(status_code=409, detail="The coding stage is not active")
    problem = await interview_multistage_service.generate_coding_problem(
        position=session.position,
        skills=request.skills,
        difficulty=request.difficulty,
    )
    return {"problem": problem}


@router.post("/hr-question")
async def get_hr_question(
    request: HRQuestionRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate an HR/behavioral interview question."""
    session = _get_owned_session(request.session_id, str(current_user.id), db)
    if session.is_completed or session.current_stage != "hr":
        raise HTTPException(status_code=409, detail="The HR stage is not active")
    question = await interview_multistage_service.generate_hr_question(
        position=session.position,
        history=request.history,
    )
    return {"question": question}


@router.post("/evaluate-stage")
async def evaluate_stage(
    request: EvaluateStageRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Evaluate a completed stage and advance to the next."""
    stage = request.stage
    session = _get_owned_session(request.session_id, str(current_user.id), db)
    if session.is_completed:
        raise HTTPException(status_code=409, detail="This interview has already been finalized")
    if session.current_stage != stage:
        raise HTTPException(status_code=409, detail="This stage has already been submitted or is not active")
    position = session.position

    # Run AI evaluation based on stage
    if stage == "screening":
        evaluation = await interview_multistage_service.evaluate_screening(
            position=position,
            responses=request.responses,
            resume_summary=request.resume_summary,
        )
    elif stage == "technical":
        evaluation = await interview_multistage_service.evaluate_technical(
            position=position,
            responses=request.responses,
            skills=request.skills,
        )
    elif stage == "coding":
        evaluation = await interview_multistage_service.evaluate_coding(
            position=position,
            problem=request.problem,
            code=request.code,
            language=request.language,
            passed_tests=request.passed_tests,
            total_tests=request.total_tests,
            attempts=request.attempts,
        )
    elif stage == "hr":
        evaluation = await interview_multistage_service.evaluate_hr(
            position=position,
            responses=request.responses,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}")

    # Save to DB
    score = evaluation.get("score", 0)
    update_result = interview_multistage_service.update_stage_result(
        session_id=request.session_id,
        user_id=str(current_user.id),
        stage=stage,
        score=score,
        stage_data={"responses": request.responses, "evaluation": evaluation},
        db=db,
    )

    if update_result.get("error"):
        raise HTTPException(status_code=409, detail=update_result["error"])
    return {
        "evaluation": evaluation,
        "session": update_result,
    }


@router.post("/final-analysis")
async def final_analysis(
    request: FinalAnalysisRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate and save the final comprehensive analysis."""
    session = _get_owned_session(request.session_id, str(current_user.id), db)
    if not session.is_completed or session.current_stage != "completed":
        raise HTTPException(status_code=409, detail="Complete every interview stage before requesting the report")
    if session.verdict:
        raise HTTPException(status_code=409, detail="A report has already been generated for this interview")
    analysis = await interview_multistage_service.generate_final_analysis(
        position=session.position,
        screening_eval=request.screening_eval,
        technical_eval=request.technical_eval,
        coding_eval=request.coding_eval,
        hr_eval=request.hr_eval,
        evidence={
            "screening": (session.screening_data or {}).get("responses", []),
            "technical": (session.technical_data or {}).get("responses", []),
            "coding": (session.coding_data or {}).get("responses", []),
            "hr": (session.hr_data or {}).get("responses", []),
        },
    )

    # Save to DB
    interview_multistage_service.save_final_results(
        session_id=request.session_id,
        user_id=str(current_user.id),
        final_analysis=analysis,
        db=db,
    )

    # Save progress snapshot
    try:
        from app.services.progress_service import save_progress_snapshot
        save_progress_snapshot(str(current_user.id), db)
    except Exception:
        pass

    return {"analysis": analysis}


@router.get("/history")
async def get_history(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get all multi-stage interview session history."""
    sessions = interview_multistage_service.get_multistage_history(
        user_id=str(current_user.id),
        db=db,
    )
    return {"sessions": sessions}
