"""
API Endpoints for AI-Driven Progress Tracking.
Integrates behind the existing Progress page.
"""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.services import document_store_service, progress_service, streak_service

router = APIRouter()


class ProgressRequest(BaseModel):
    resume_ats_score: float = 0.0


@router.get("/current")
async def get_current_progress(
    resume_ats_score: float = 0.0,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the current Career Readiness Score and all metrics.
    Does NOT save a snapshot (use /snapshot for that).
    """
    try:
        metrics = progress_service.calculate_career_readiness(
            user_id=str(current_user.id),
            db=db,
            resume_ats_score=resume_ats_score
        )
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/snapshot")
async def save_snapshot(
    request: ProgressRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Calculate and save a progress snapshot.
    Call after significant actions (quiz pass, skill complete, etc).
    """
    try:
        snapshot = progress_service.save_progress_snapshot(
            user_id=str(current_user.id),
            db=db,
            resume_ats_score=request.resume_ats_score
        )
        return snapshot
    except Exception as e:
        document_store_service.record_task_log(
            task_name="progress_snapshot",
            status="failed",
            source="api",
            user_id=str(current_user.id),
            details={"error": str(e)},
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_progress_history(
    limit: int = 30,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Get historical progress snapshots for growth charts.
    Returns data sorted oldest-first for chart rendering.
    """
    history = progress_service.get_progress_history(
        user_id=str(current_user.id),
        db=db,
        limit=limit
    )
    return {"snapshots": history}


@router.delete("/snapshot/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: str,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a single progress snapshot owned by the current user.
    """
    try:
        deleted = progress_service.delete_progress_snapshot(
            user_id=str(current_user.id),
            db=db,
            snapshot_id=snapshot_id,
        )
        if not deleted:
            return {"deleted": False}
        return {"deleted": True}
    except Exception as e:
        document_store_service.record_task_log(
            task_name="progress_snapshot_delete",
            status="failed",
            source="api",
            user_id=str(current_user.id),
            details={"snapshot_id": snapshot_id, "error": str(e)},
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/streak")
async def get_streak(
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Get daily login streak stats (UTC day).
    """
    return streak_service.get_streak(user_id=str(current_user.id))


@router.post("/streak/touch")
async def touch_streak(
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Touch streak for today (increment if new day). Call this on login/app load.
    """
    return streak_service.touch_streak(user_id=str(current_user.id))
