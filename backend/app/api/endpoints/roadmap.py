"""
API Endpoints for the AI Roadmap Engine.
Integrates with the Plan page (CareerIntelligence).
Supports multiple roadmaps per user with switcher.
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api import deps
from app.services import roadmap_service
from app.middleware.require_usage_limit import require_usage_limit
from app.services.usage_service import LimitExceededError, sync_usage_counts
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class RoadmapRequest(BaseModel):
    target_role: str
    current_skills: List[str] = Field(default_factory=list)
    skill_gaps: List[str] = Field(default_factory=list)
    topic_name: Optional[str] = None
    difficulty: Optional[str] = None  # "Beginner", "Intermediate", "Advanced"


class SkillUpdateRequest(BaseModel):
    roadmap_id: str
    skill_id: str
    status: str  # "completed", "unlocked", "locked"


class SetActiveRequest(BaseModel):
    roadmap_id: str


class DeleteRoadmapRequest(BaseModel):
    roadmap_id: str


@router.post("/generate")
async def generate_roadmap(
    request: RoadmapRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(require_usage_limit("plan_count")),
) -> Any:
    """Generate a personalized skill roadmap using AI. Enforces plan_count limit."""
    try:
        result = await roadmap_service.generate_roadmap(
            user_id=str(current_user.id),
            target_role=request.target_role,
            current_skills=request.current_skills,
            skill_gaps=request.skill_gaps,
            db=db,
            topic_name=request.topic_name,
            difficulty=request.difficulty,
            commit=False,
        )
        sync_usage_counts(db, current_user.id, counters=["roadmap"])
        db.commit()

        return result
    except LimitExceededError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=e.detail) from e
    except ValueError as e:
        db.rollback()
        logger.warning("Roadmap validation failed: %s", str(e))
        raise HTTPException(status_code=400, detail="Invalid roadmap request")
    except Exception as e:
        db.rollback()
        logger.exception("Roadmap generation failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Roadmap generation failed")


@router.post("/create")
async def create_roadmap_alias(
    request: RoadmapRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(require_usage_limit("plan_count")),
) -> Any:
    """Alias endpoint for SaaS roadmap creation."""
    return await generate_roadmap(
        request=request,
        db=db,
        current_user=current_user,
    )


@router.get("/active")
async def get_active_roadmap(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get the user's active roadmap."""
    roadmap = roadmap_service.get_user_roadmap(str(current_user.id), db)
    if not roadmap:
        return {"roadmap": None, "message": "No active roadmap found. Generate one first."}
    return {"roadmap": roadmap}


@router.get("/all")
async def get_all_roadmaps(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get all roadmaps for the current user (for the switcher)."""
    roadmaps = roadmap_service.get_all_user_roadmaps(str(current_user.id), db)
    return {"roadmaps": roadmaps}


@router.get("/list")
async def list_roadmaps_alias(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Alias endpoint for SaaS roadmap listing."""
    return await get_all_roadmaps(db=db, current_user=current_user)


@router.post("/set-active")
async def set_active_roadmap(
    request: SetActiveRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Switch the active roadmap for the current user."""
    try:
        result = roadmap_service.set_active_roadmap(
            user_id=str(current_user.id),
            roadmap_id=request.roadmap_id,
            db=db
        )
        return result
    except ValueError as e:
        logger.warning("Set active roadmap validation failed: %s", str(e))
        raise HTTPException(status_code=404, detail="Roadmap not found")
    except Exception as e:
        logger.exception("Set active roadmap failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to set active roadmap")


@router.post("/delete")
async def delete_roadmap(
    request: DeleteRoadmapRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Delete a roadmap."""
    try:
        result = roadmap_service.delete_roadmap(
            user_id=str(current_user.id),
            roadmap_id=request.roadmap_id,
            db=db,
            commit=False,
        )
        sync_usage_counts(db, current_user.id, counters=["roadmap"])
        db.commit()
        return result
    except ValueError as e:
        db.rollback()
        logger.warning("Delete roadmap validation failed: %s", str(e))
        raise HTTPException(status_code=404, detail="Roadmap not found")
    except Exception as e:
        db.rollback()
        logger.exception("Delete roadmap failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to delete roadmap")


@router.post("/update-skill")
async def update_skill(
    request: SkillUpdateRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Update a skill's status in the roadmap."""
    try:
        result = roadmap_service.update_skill_status(
            user_id=str(current_user.id),
            roadmap_id=request.roadmap_id,
            skill_id=request.skill_id,
            new_status=request.status,
            db=db
        )
        return result
    except ValueError as e:
        logger.warning("Update skill validation failed: %s", str(e))
        raise HTTPException(status_code=400, detail="Invalid skill update request")
    except Exception as e:
        logger.exception("Update skill status failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to update skill status")
