"""
API Endpoints for Code Execution — Real code compilation and running.
Provides /run-code and /submit-code endpoints for the coding environment.
"""
from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.api import deps
from app.services import code_execution_service

router = APIRouter()


# ─── Request Schemas ─────────────────────────────────────

class RunCodeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50_000)
    language: str = Field(default="python", max_length=20)
    test_cases: List[Dict[str, Any]] = Field(default_factory=list, max_length=50)


class SubmitCodeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50_000)
    language: str = Field(default="python", max_length=20)
    test_cases: List[Dict[str, Any]] = Field(default_factory=list, max_length=50)
    session_id: Optional[str] = Field(default=None, max_length=200)
    problem_title: Optional[str] = Field(default=None, max_length=200)


# ─── Endpoints ───────────────────────────────────────────

@router.post("/run-code")
async def run_code(
    request: RunCodeRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Run user code against visible test cases only.
    Returns compilation errors, runtime errors, or test results.
    """
    result = code_execution_service.run_code(
        code=request.code,
        language=request.language,
        test_cases=request.test_cases,
        include_hidden=False,
    )
    return result


@router.post("/submit-code")
async def submit_code(
    request: SubmitCodeRequest,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Submit user code against ALL test cases (including hidden).
    Returns full evaluation results.
    """
    result = code_execution_service.run_code(
        code=request.code,
        language=request.language,
        test_cases=request.test_cases,
        include_hidden=True,
    )
    return result
