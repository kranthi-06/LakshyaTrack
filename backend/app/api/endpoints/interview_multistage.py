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

router = APIRouter()


# ─── Request Schemas ────────────────────────────────────

class CreateSessionRequest(BaseModel):
    position: str = "Software Engineer"
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
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=exc.detail) from exc
    except Exception:
        db.rollback()
        raise


@router.post("/screening-question")
async def get_screening_question(
    request: ScreeningQuestionRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a resume screening question."""
    question = await interview_multistage_service.generate_screening_question(
        position="Software Engineer",
        resume_summary=request.resume_summary,
        history=request.history,
        skills=request.skills,
        projects=request.projects,
    )
    return {"question": question}


@router.post("/technical-question")
async def get_technical_question(
    request: TechnicalQuestionRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a technical interview question."""
    question = await interview_multistage_service.generate_technical_question(
        position="Software Engineer",
        skills=request.skills,
        history=request.history,
    )
    return {"question": question}


@router.post("/coding-problem")
async def get_coding_problem(
    request: CodingProblemRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a coding problem with test cases."""
    problem = await interview_multistage_service.generate_coding_problem(
        position="Software Engineer",
        skills=request.skills,
        difficulty=request.difficulty,
    )
    return {"problem": problem}


@router.post("/hr-question")
async def get_hr_question(
    request: HRQuestionRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate an HR/behavioral interview question."""
    question = await interview_multistage_service.generate_hr_question(
        position="Software Engineer",
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
    position = "Software Engineer"

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
    analysis = await interview_multistage_service.generate_final_analysis(
        position="Software Engineer",
        screening_eval=request.screening_eval,
        technical_eval=request.technical_eval,
        coding_eval=request.coding_eval,
        hr_eval=request.hr_eval,
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
