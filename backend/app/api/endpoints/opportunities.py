"""
API Endpoints for the Opportunity Portal.
Supports browsing, searching, filtering, and AI-powered recommendations
across courses, internships, certifications, and jobs.
"""
from typing import Any, List, Optional
import base64
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api import deps
from app.services import opportunity_service

router = APIRouter()
import logging
logger = logging.getLogger(__name__)


# ── Request Schemas ────────────────────────────────────────

class OpportunitySearchRequest(BaseModel):
    target_role: str
    skills: List[str] = Field(default_factory=list)
    level: str = "Beginner"


class OpportunityFilterRequest(BaseModel):
    skills: List[str] = Field(default_factory=list)
    level: Optional[str] = None
    opportunity_type: Optional[str] = None  # "job", "internship", "course", "certification"
    limit: int = 20


class OpportunityRecommendRequest(BaseModel):
    skills: List[str] = Field(default_factory=list)
    target_role: str = "Software Engineer"
    limit: int = 12


class LiveSearchRequest(BaseModel):
    search_query: str
    category: Optional[str] = None  # "course", "internship", "certification", "job", "all"


# ── Endpoints ──────────────────────────────────────────────

@router.get("/browse")
async def browse_opportunities(
    category: Optional[str] = Query(None, description="course|internship|certification|job|all"),
    skill: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None, description="Base64 cursor for keyset pagination"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Browse opportunities with optional filters and pagination.
    Supports filtering by category, skill, location, and text search.
    """
    cursor_created_at = None
    cursor_id = None
    if cursor:
        try:
            decoded = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
            payload = json.loads(decoded)
            cursor_created_at = datetime.fromisoformat(payload["created_at"])
            cursor_id = payload["id"]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid cursor")

    result = opportunity_service.browse_opportunities(
        db=db,
        category=category,
        skill=skill,
        location=location,
        search_query=search,
        page=page,
        per_page=per_page,
        cursor_created_at=cursor_created_at,
        cursor_id=cursor_id,
    )
    if result.get("next_cursor"):
        result["next_cursor"] = base64.urlsafe_b64encode(
            json.dumps(result["next_cursor"]).encode("utf-8")
        ).decode("utf-8")
    return result


@router.get("/filters")
async def get_filter_options(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get available filter options (locations, categories, top skills)."""
    return opportunity_service.get_filter_options(db)


@router.post("/discover")
async def discover_opportunities(
    request: OpportunitySearchRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Discover new opportunities using AI.
    Generates and saves opportunities matched to user's roadmap/skills.
    """
    try:
        opportunities = await opportunity_service.generate_opportunities(
            target_role=request.target_role,
            skills=request.skills,
            level=request.level,
            db=db
        )
        return {"opportunities": opportunities, "count": len(opportunities)}
    except Exception as e:
        logger.exception("Failed to discover opportunities: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to discover opportunities")


@router.post("/matched")
async def get_matched_opportunities(
    request: OpportunityFilterRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Get opportunities from the database matched to user skills.
    Sorted by match score.
    """
    opportunities = opportunity_service.get_matched_opportunities(
        user_skills=request.skills,
        level=request.level,
        opportunity_type=request.opportunity_type,
        db=db,
        limit=request.limit
    )
    return {"opportunities": opportunities, "count": len(opportunities)}


@router.post("/recommend")
async def get_recommendations(
    request: OpportunityRecommendRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    AI-powered recommendations based on user's resume and skill profile.
    Combines DB matches with freshly generated opportunities.
    """
    try:
        recommendations = await opportunity_service.get_ai_recommendations(
            user_skills=request.skills,
            user_role=request.target_role,
            db=db,
            limit=request.limit,
        )
        return {"opportunities": recommendations, "count": len(recommendations)}
    except Exception as e:
        logger.exception("Failed to fetch recommendations: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch recommendations")


@router.post("/live-search")
async def live_search(
    request: LiveSearchRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Live search: combines database search with AI-powered generation
    to return fresh, relevant results based on the user's search query.
    """
    if not request.search_query or len(request.search_query.strip()) < 2:
        return {"opportunities": [], "total": 0, "db_count": 0, "ai_count": 0, "search_query": ""}

    try:
        result = await opportunity_service.live_search_opportunities(
            search_query=request.search_query.strip(),
            category=request.category,
            db=db,
        )
        return result
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Live search endpoint error: {e}")
        return {
            "opportunities": [],
            "total": 0,
            "db_count": 0,
            "ai_count": 0,
            "search_query": request.search_query,
        }


@router.post("/fetch-external")
async def fetch_external_sources(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """
    Trigger fetching from external sources (RSS feeds + public APIs).
    Can be used by admin or the scheduler.
    """
    try:
        rss_count = await opportunity_service.fetch_rss_opportunities(db)
        api_count = await opportunity_service.fetch_public_api_opportunities(db)
        return {
            "rss_fetched": rss_count,
            "api_fetched": api_count,
            "total_new": rss_count + api_count,
        }
    except Exception as e:
        logger.exception("Failed to fetch external opportunities: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch external opportunities")


@router.post("/cleanup")
async def cleanup_expired(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Mark expired opportunities and remove duplicates."""
    expired_count = opportunity_service.cleanup_expired_opportunities(db)
    dupe_count = opportunity_service.remove_duplicates(db)
    return {"expired_count": expired_count, "duplicates_removed": dupe_count}
