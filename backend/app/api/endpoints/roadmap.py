"""
API Endpoints for the AI Roadmap Engine.
Integrates with the Plan page (CareerIntelligence).
Supports multiple roadmaps per user with switcher.
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.services import roadmap_service

router = APIRouter()


class RoadmapRequest(BaseModel):
    target_role: str
    current_skills: List[str] = []
    skill_gaps: List[str] = []
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
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Generate a personalized skill roadmap using AI."""
    try:
        result = await roadmap_service.generate_roadmap(
            user_id=str(current_user.id),
            target_role=request.target_role,
            current_skills=request.current_skills,
            skill_gaps=request.skill_gaps,
            db=db,
            topic_name=request.topic_name,
            difficulty=request.difficulty,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap generation failed: {str(e)}")


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            db=db
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
