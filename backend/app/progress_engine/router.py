"""
Progress Engine — FastAPI Router
Production-grade API endpoints for the Progress Intelligence Dashboard.

Endpoints:
  POST /events/ingest       — Ingest a single event
  POST /events/batch        — Ingest batch of events
  GET  /dashboard            — Full precomputed dashboard
  GET  /contributions        — Heatmap data
  GET  /problems             — Problem-solving analytics
  GET  /activity             — Activity summary
  GET  /time-analytics       — Time analytics
  GET  /topics               — Skill bubble map
  GET  /streak               — Streak data
  POST /streak/touch         — Touch streak
  GET  /badges               — Badge/achievement state
  GET  /timeline             — Activity timeline (NEW)
  GET  /intelligence         — AI insights
  POST /workers/flush        — Manual event flush
  POST /workers/aggregate    — Manual daily aggregation
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User

from . import analytics, events, workers, redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress-engine", tags=["Progress Engine"])


# ══════════════════════════════════════════════════════════════
# Request/Response Schemas
# ══════════════════════════════════════════════════════════════

class EventIngestRequest(BaseModel):
    event_type: str
    metadata: dict = Field(default_factory=dict)
    session_id: Optional[str] = None
    device_info: Optional[dict] = None
    timestamp: Optional[str] = None
    event_id: Optional[str] = None


class BatchIngestRequest(BaseModel):
    events: list[EventIngestRequest] = Field(..., max_length=100)


class TimelineQuery(BaseModel):
    filter: str = "today"  # today, week, month, all
    page: int = 1
    per_page: int = 20


# ══════════════════════════════════════════════════════════════
# EVENT INGESTION — High-throughput, non-blocking
# ══════════════════════════════════════════════════════════════

@router.post("/events/ingest")
async def ingest_event(
    body: EventIngestRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Ingest a single user event. Non-blocking, buffered write.
    This is the primary tracking endpoint — called by frontend on every user action.
    """
    raw = {
        "event_type": body.event_type,
        "user_id": str(current_user.id),
        "session_id": body.session_id,
        "metadata": body.metadata,
        "device_info": body.device_info or {},
        "timestamp": body.timestamp,
        "event_id": body.event_id,
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", ""),
    }

    result = events.ingest_event(raw)
    return result


@router.post("/events/batch")
async def ingest_batch(
    body: BatchIngestRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Ingest a batch of events. More efficient for buffered frontend sends.
    Max 100 events per batch.
    """
    raw_events = []
    for evt in body.events:
        raw_events.append({
            "event_type": evt.event_type,
            "user_id": str(current_user.id),
            "session_id": evt.session_id,
            "metadata": evt.metadata,
            "device_info": evt.device_info or {},
            "timestamp": evt.timestamp,
            "event_id": evt.event_id,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent", ""),
        })

    result = events.ingest_batch(raw_events)
    return result


# ══════════════════════════════════════════════════════════════
# DASHBOARD — Full precomputed data
# ══════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
):
    """
    Get the complete Progress Intelligence Dashboard.
    Returns all sections in a single response. All data is precomputed.
    """
    return analytics.get_full_dashboard(str(current_user.id))


# ══════════════════════════════════════════════════════════════
# INDIVIDUAL SECTION ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/contributions")
async def get_contributions(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Get contribution heatmap data for a specific year."""
    if year is None:
        year = datetime.now(timezone.utc).year
    return analytics.get_contributions(str(current_user.id), year)


@router.get("/problems")
async def get_problems(
    current_user: User = Depends(get_current_user),
):
    """Get problem-solving analytics."""
    return analytics.get_problem_stats(str(current_user.id))


@router.get("/activity")
async def get_activity(
    current_user: User = Depends(get_current_user),
):
    """Get activity tracking summary."""
    return analytics.get_activity_summary(str(current_user.id))


@router.get("/time-analytics")
async def get_time_analytics(
    current_user: User = Depends(get_current_user),
):
    """Get time analytics & charts data."""
    return analytics.get_time_analytics(str(current_user.id))


@router.get("/topics")
async def get_topics(
    current_user: User = Depends(get_current_user),
):
    """Get skill/topic bubble map data."""
    return analytics.get_topic_map(str(current_user.id))


@router.get("/streak")
async def get_streak(
    current_user: User = Depends(get_current_user),
):
    """Get streak data with risk assessment."""
    return analytics.get_streak_data(str(current_user.id))


@router.post("/streak/touch")
async def touch_streak(
    current_user: User = Depends(get_current_user),
):
    """Touch streak — call on first daily activity."""
    return workers.run_streak_update(str(current_user.id))


@router.get("/badges")
async def get_badges(
    current_user: User = Depends(get_current_user),
):
    """Get badge/achievement system state."""
    return analytics.get_badges(str(current_user.id))


@router.get("/timeline")
async def get_timeline(
    filter: str = Query("today", description="today|week|month|all"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """
    Get activity timeline. New chronological feed of user actions.
    Supports pagination and time-range filtering.
    """
    return analytics.get_activity_timeline(
        str(current_user.id), filter_range=filter, page=page, per_page=per_page,
    )


@router.get("/intelligence")
async def get_intelligence(
    current_user: User = Depends(get_current_user),
):
    """Get AI-powered insights and recommendations."""
    return analytics.get_intelligence(str(current_user.id))


# ══════════════════════════════════════════════════════════════
# WORKER ENDPOINTS (admin/internal)
# ══════════════════════════════════════════════════════════════

@router.post("/workers/flush")
async def manual_flush(
    current_user: User = Depends(get_current_user),
):
    """Manually flush event buffer to database."""
    result = workers.run_event_flusher()
    return {"status": "flushed", **result}


@router.post("/workers/aggregate")
async def manual_aggregate(
    current_user: User = Depends(get_current_user),
):
    """Manually run daily aggregation for current user."""
    result = workers.run_daily_aggregation(str(current_user.id))
    return {"status": "aggregated", "has_data": result is not None}


# ══════════════════════════════════════════════════════════════
# HEALTH & METRICS
# ══════════════════════════════════════════════════════════════

@router.get("/health")
async def engine_health():
    """Progress Engine health check."""
    return {
        "status": "healthy",
        "event_buffer_size": redis_client.get_buffer_size(),
        "redis_available": redis_client._get_redis() is not None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
