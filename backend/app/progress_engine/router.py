"""
Progress Engine FastAPI router.

This router powers the Progress Intelligence dashboard and the live tracking
pipeline used by the frontend.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User

from . import analytics, events, realtime, redis_client, workers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress-engine", tags=["Progress Engine"])


class EventIngestRequest(BaseModel):
    event_type: str
    metadata: dict = Field(default_factory=dict)
    session_id: Optional[str] = None
    device_info: Optional[dict] = None
    timestamp: Optional[str] = None
    event_id: Optional[str] = None


class BatchIngestRequest(BaseModel):
    events: list[EventIngestRequest] = Field(..., max_length=100)


def _format_sse(event_name: str, payload: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(payload, default=str)}\n\n"


@router.post("/events/ingest")
async def ingest_event(
    body: EventIngestRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
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
    return events.ingest_event(raw)


@router.post("/events/batch")
async def ingest_batch(
    body: BatchIngestRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    raw_events = [
        {
            "event_type": event.event_type,
            "user_id": str(current_user.id),
            "session_id": event.session_id,
            "metadata": event.metadata,
            "device_info": event.device_info or {},
            "timestamp": event.timestamp,
            "event_id": event.event_id,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent", ""),
        }
        for event in body.events
    ]
    return events.ingest_batch(raw_events)


@router.get("/stream")
async def stream_updates(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    user_id = str(current_user.id)
    subscriber_id, local_queue = realtime.subscribe_local(user_id)
    pubsub = realtime.open_pubsub(user_id)

    async def event_generator():
        last_heartbeat_at = datetime.now(timezone.utc)
        try:
            yield _format_sse(
                "ready",
                {
                    "kind": "ready",
                    "userId": user_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

            while True:
                if await request.is_disconnected():
                    break

                message: Optional[str] = None
                if pubsub is not None:
                    message = await asyncio.to_thread(realtime.read_pubsub_message, pubsub, 1.0)

                if message is None:
                    try:
                        message = await asyncio.wait_for(local_queue.get(), timeout=1.0)
                    except asyncio.TimeoutError:
                        message = None

                now = datetime.now(timezone.utc)
                if message is not None:
                    yield f"event: update\ndata: {message}\n\n"
                    last_heartbeat_at = now
                    continue

                if (now - last_heartbeat_at).total_seconds() >= 15:
                    yield _format_sse("ping", {"timestamp": now.isoformat()})
                    last_heartbeat_at = now
        finally:
            realtime.unsubscribe_local(user_id, subscriber_id)
            if pubsub is not None:
                await asyncio.to_thread(pubsub.close)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_full_dashboard(str(current_user.id))


@router.get("/contributions")
async def get_contributions(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    if year is None:
        year = datetime.now(timezone.utc).year
    return analytics.get_contributions(str(current_user.id), year)


@router.get("/problems")
async def get_problems(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_problem_stats(str(current_user.id))


@router.get("/activity")
async def get_activity(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_activity_summary(str(current_user.id))


@router.get("/time-analytics")
async def get_time_analytics(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_time_analytics(str(current_user.id))


@router.get("/topics")
async def get_topics(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_topic_map(str(current_user.id))


@router.get("/streak")
async def get_streak(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_streak_data(str(current_user.id))


@router.post("/streak/touch")
async def touch_streak(
    current_user: User = Depends(get_current_user),
):
    user_id = str(current_user.id)
    result = workers.run_streak_update(user_id)
    realtime.publish_user_update(
        user_id,
        {
            "kind": "streak_updated",
            "userId": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    return result


@router.get("/badges")
async def get_badges(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_badges(str(current_user.id))


@router.get("/timeline")
async def get_timeline(
    filter: str = Query("today", description="today|week|month|all"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    return analytics.get_activity_timeline(
        str(current_user.id),
        filter_range=filter,
        page=page,
        per_page=per_page,
    )


@router.get("/intelligence")
async def get_intelligence(
    current_user: User = Depends(get_current_user),
):
    return analytics.get_intelligence(str(current_user.id))


@router.post("/workers/flush")
async def manual_flush(
    current_user: User = Depends(get_current_user),
):
    result = workers.run_event_flusher()
    realtime.publish_user_update(
        str(current_user.id),
        {
            "kind": "buffer_flushed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "flushed": result.get("flushed", 0),
        },
    )
    return {"status": "flushed", **result}


@router.post("/workers/aggregate")
async def manual_aggregate(
    current_user: User = Depends(get_current_user),
):
    user_id = str(current_user.id)
    result = workers.run_daily_aggregation(user_id)
    realtime.publish_user_update(
        user_id,
        {
            "kind": "aggregate_updated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"status": "aggregated", "has_data": result is not None}


@router.get("/health")
async def engine_health():
    return {
        "status": "healthy",
        "event_buffer_size": redis_client.get_buffer_size(),
        "redis_available": redis_client._get_redis() is not None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
