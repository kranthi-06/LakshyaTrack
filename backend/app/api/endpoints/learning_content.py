"""
API Endpoints for AI Learning Content Suggestions.
Provides cached learning resources per roadmap skill.
"""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.services import learning_content_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class LearningRequest(BaseModel):
    skill_name: str
    level: str = "Beginner"


@router.post("/resources")
async def get_skill_resources(
    request: LearningRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Get AI-curated learning resources (YouTube videos) for a skill.
    Results are cached to avoid repeated AI calls.
    """
    try:
        resources = await learning_content_service.get_learning_resources(
            skill_name=request.skill_name,
            level=request.level,
            db=db
        )
        return {
            "skill_name": request.skill_name,
            "level": request.level,
            "resources": resources
        }
    except Exception as e:
        logger.exception("Failed to fetch learning resources: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch learning resources")


@router.post("/refresh")
async def refresh_skill_resources(
    request: LearningRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Force-refresh learning resources for a skill (clears cache).
    """
    try:
        learning_content_service.clear_skill_cache(request.skill_name, db)
        resources = await learning_content_service.get_learning_resources(
            skill_name=request.skill_name,
            level=request.level,
            db=db
        )
        return {
            "skill_name": request.skill_name,
            "level": request.level,
            "resources": resources,
            "refreshed": True
        }
    except Exception as e:
        logger.exception("Failed to refresh learning resources: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to refresh learning resources")
