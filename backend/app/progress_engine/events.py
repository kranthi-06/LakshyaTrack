"""
Progress Engine event ingestion service.

Durability goals:
  - Validate and deduplicate every event
  - Persist accepted events immediately
  - Keep analytics caches fresh
  - Publish real-time invalidation messages for live dashboards
"""
from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.db.mongodb import get_collection
from app.db.session import SessionLocal
from app.progress_system.models import ActivityLog

from . import realtime, redis_client

logger = logging.getLogger(__name__)

VALID_EVENT_TYPES = frozenset({
    "PAGE_VISIT",
    "PROBLEM_SOLVED",
    "QUIZ_COMPLETED",
    "FEATURE_USED",
    "SESSION_START",
    "SESSION_END",
    "IDLE",
    "ACTIVE",
    "RESUME_ANALYZED",
    "INTERVIEW_COMPLETED",
    "ROADMAP_GENERATED",
    "BADGE_UNLOCKED",
    "STREAK_EXTENDED",
    "CODE_EXECUTED",
})

MAX_METADATA_SIZE = 4096
DEDUP_WINDOW_SECONDS = 60

MEANINGFUL_EVENT_TYPES = frozenset({
    "PROBLEM_SOLVED",
    "QUIZ_COMPLETED",
    "INTERVIEW_COMPLETED",
    "ROADMAP_GENERATED",
    "RESUME_ANALYZED",
    "CODE_EXECUTED",
})

PRESENCE_EVENT_TYPES = MEANINGFUL_EVENT_TYPES | {
    "PAGE_VISIT",
    "FEATURE_USED",
    "SESSION_START",
}

_recent_event_ids: Dict[str, float] = {}


class EventValidationError(Exception):
    pass


def validate_event(event: Dict[str, Any]) -> Dict[str, Any]:
    event_type = event.get("event_type", "").strip().upper()
    if event_type not in VALID_EVENT_TYPES:
        raise EventValidationError(f"Invalid event_type: {event_type}")

    user_id = event.get("user_id")
    if not user_id or not isinstance(user_id, str):
        raise EventValidationError("Missing or invalid user_id")

    metadata = event.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    metadata_size = len(json.dumps(metadata, default=str))
    if metadata_size > MAX_METADATA_SIZE:
        raise EventValidationError(
            f"Metadata too large: {metadata_size} bytes (max {MAX_METADATA_SIZE})"
        )

    session_id = event.get("session_id") or str(uuid.uuid4())
    device_info = event.get("device_info", {})
    if not isinstance(device_info, dict):
        device_info = {}

    event_id = event.get("event_id") or str(uuid.uuid4())
    timestamp = event.get("timestamp")
    if isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            timestamp = datetime.now(timezone.utc)
    elif not isinstance(timestamp, datetime):
        timestamp = datetime.now(timezone.utc)

    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    return {
        "event_id": event_id,
        "user_id": user_id,
        "session_id": session_id,
        "event_type": event_type,
        "metadata": metadata,
        "device_info": device_info,
        "timestamp": timestamp,
        "ip_address": event.get("ip_address"),
        "user_agent": event.get("user_agent"),
    }


def _compute_dedup_key(event: Dict[str, Any]) -> str:
    timestamp = event.get("timestamp")
    if isinstance(timestamp, datetime):
        timestamp = timestamp.astimezone(timezone.utc).isoformat()
    elif timestamp is None:
        timestamp = ""

    raw = json.dumps(
        {
            "user_id": event["user_id"],
            "event_type": event["event_type"],
            "session_id": event.get("session_id"),
            "timestamp": timestamp,
            "metadata": event.get("metadata", {}),
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def is_duplicate_event(event: Dict[str, Any]) -> bool:
    event_id = event.get("event_id", "")
    now = datetime.now(timezone.utc).timestamp()

    expired = [key for key, seen_at in _recent_event_ids.items() if now - seen_at > DEDUP_WINDOW_SECONDS]
    for key in expired:
        _recent_event_ids.pop(key, None)

    dedup_key = _compute_dedup_key(event)
    if redis_client.cache_get(f"dedup:{dedup_key}"):
        return True

    if event_id in _recent_event_ids or dedup_key in _recent_event_ids:
        return True

    _recent_event_ids[event_id] = now
    _recent_event_ids[dedup_key] = now
    redis_client.cache_set(f"dedup:{dedup_key}", "1", ttl_seconds=DEDUP_WINDOW_SECONDS)

    if len(_recent_event_ids) > 50000:
        sorted_keys = sorted(_recent_event_ids, key=_recent_event_ids.get)
        for key in sorted_keys[: len(sorted_keys) // 2]:
            _recent_event_ids.pop(key, None)

    return False


def _persist_events_to_sql(events: List[Dict[str, Any]]) -> int:
    if not events:
        return 0

    session = SessionLocal()
    try:
        rows = [
            ActivityLog(
                user_id=event["user_id"],
                event_type=event["event_type"],
                event_metadata=event.get("metadata") or {},
                ip_address=event.get("ip_address"),
                user_agent=event.get("user_agent"),
                session_id=event.get("session_id"),
                timestamp=event.get("timestamp"),
            )
            for event in events
        ]
        session.add_all(rows)
        session.commit()
        return len(rows)
    except Exception:
        session.rollback()
        logger.error("Failed to persist progress events to SQL fallback.", exc_info=True)
        return 0
    finally:
        session.close()


def _persist_events_to_mongo(events: List[Dict[str, Any]]) -> int:
    if not events:
        return 0

    collection = get_collection("pe_events")
    if collection is None:
        return 0

    docs = []
    for event in events:
        doc = dict(event)
        if not isinstance(doc.get("timestamp"), datetime):
            doc["timestamp"] = datetime.now(timezone.utc)
        docs.append(doc)

    try:
        result = collection.insert_many(docs, ordered=False)
        count = len(result.inserted_ids)
        logger.info("Persisted %d progress events to MongoDB.", count)
        return count
    except Exception:
        logger.error("Failed to persist progress events to MongoDB.", exc_info=True)
        return 0


def _persist_events_immediately(events: List[Dict[str, Any]]) -> Dict[str, int]:
    mongo_count = _persist_events_to_mongo(events)
    sql_count = _persist_events_to_sql(events)
    buffered_count = 0

    if mongo_count == 0 and sql_count == 0:
        for event in events:
            redis_client.buffer_event(event)
        buffered_count = len(events)
        logger.warning(
            "Buffered %d progress events in memory because durable persistence failed.",
            buffered_count,
        )

    return {
        "mongo": mongo_count,
        "sql": sql_count,
        "buffered": buffered_count,
    }


def _publish_progress_update(
    user_id: str,
    events: List[Dict[str, Any]],
    persistence: Dict[str, int],
) -> None:
    if not events:
        return

    latest_timestamp = max(
        (
            event["timestamp"]
            if isinstance(event.get("timestamp"), datetime)
            else datetime.now(timezone.utc)
        )
        for event in events
    )
    realtime.publish_user_update(
        user_id,
        {
            "kind": "progress_updated",
            "userId": user_id,
            "eventCount": len(events),
            "eventTypes": sorted({event["event_type"] for event in events}),
            "timestamp": latest_timestamp.astimezone(timezone.utc).isoformat(),
            "persistence": persistence,
        },
    )


def _update_realtime_counters(event: Dict[str, Any]) -> None:
    user_id = event["user_id"]
    event_type = event["event_type"]

    if event_type in PRESENCE_EVENT_TYPES:
        redis_client.incr_daily_activity(user_id)

    if event_type == "SESSION_START":
        redis_client.register_active_session(user_id, event["session_id"])
    elif event_type == "SESSION_END":
        redis_client.end_active_session(event["session_id"])


def ingest_event(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        event = validate_event(raw_event)
        if is_duplicate_event(event):
            return {"status": "duplicate", "event_id": event["event_id"]}

        persistence = _persist_events_immediately([event])
        _update_realtime_counters(event)
        redis_client.invalidate_user_analytics(event["user_id"])
        _publish_progress_update(event["user_id"], [event], persistence)

        return {
            "status": "accepted",
            "event_id": event["event_id"],
            "event_type": event["event_type"],
            "persistence": persistence,
        }
    except EventValidationError as exc:
        logger.warning("Event validation failed: %s", str(exc))
        return {"status": "rejected", "error": str(exc)}
    except Exception:
        logger.error("Event ingestion error.", exc_info=True)
        return {"status": "error", "error": "Internal processing error"}


def ingest_batch(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    accepted_events: List[Dict[str, Any]] = []
    results: Dict[str, Any] = {"accepted": 0, "duplicates": 0, "rejected": 0, "errors": 0}

    for raw_event in events:
        try:
            event = validate_event(raw_event)
            if is_duplicate_event(event):
                results["duplicates"] += 1
                continue
            accepted_events.append(event)
        except EventValidationError as exc:
            logger.warning("Event validation failed in batch: %s", str(exc))
            results["rejected"] += 1
        except Exception:
            logger.error("Event ingestion error in batch.", exc_info=True)
            results["errors"] += 1

    if accepted_events:
        persistence = _persist_events_immediately(accepted_events)
        for event in accepted_events:
            _update_realtime_counters(event)
            redis_client.invalidate_user_analytics(event["user_id"])
        _publish_progress_update(accepted_events[0]["user_id"], accepted_events, persistence)
        results["accepted"] = len(accepted_events)
        results["persistence"] = persistence

    return results


def flush_to_database() -> int:
    events = redis_client.flush_event_buffer()
    if not events:
        return 0

    persistence = _persist_events_immediately(events)
    return max(persistence["mongo"], persistence["sql"], persistence["buffered"])
