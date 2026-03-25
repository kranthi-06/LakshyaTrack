"""
Progress Engine — Event Ingestion Service
High-throughput, non-blocking event pipeline.

Flow: Frontend → Event API → Buffer → Worker → Database → Cache → UI

Event Types:
  PAGE_VISIT, PROBLEM_SOLVED, QUIZ_COMPLETED, FEATURE_USED,
  SESSION_START, SESSION_END, IDLE, ACTIVE

Security:
  - JWT-authenticated
  - Event validation & sanitization
  - Idempotent via eventId dedup
  - Rate-limited at API gateway level
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.db.mongodb import get_collection

from . import redis_client

logger = logging.getLogger(__name__)

# ── Allowed event types ───────────────────────────────────────

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

# Maximum metadata size (bytes) to prevent abuse
MAX_METADATA_SIZE = 4096

# Dedup window
DEDUP_WINDOW_SECONDS = 60


# ══════════════════════════════════════════════════════════════
# Event Schema & Validation
# ══════════════════════════════════════════════════════════════

class EventValidationError(Exception):
    pass


def validate_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and sanitize an incoming event.
    Returns cleaned event dict or raises EventValidationError.
    """
    # Required fields
    event_type = event.get("event_type", "").strip().upper()
    if event_type not in VALID_EVENT_TYPES:
        raise EventValidationError(f"Invalid event_type: {event_type}")

    user_id = event.get("user_id")
    if not user_id or not isinstance(user_id, str):
        raise EventValidationError("Missing or invalid user_id")

    # Optional fields
    metadata = event.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    # Sanitize metadata size
    import json
    meta_size = len(json.dumps(metadata, default=str))
    if meta_size > MAX_METADATA_SIZE:
        raise EventValidationError(f"Metadata too large: {meta_size} bytes (max {MAX_METADATA_SIZE})")

    session_id = event.get("session_id") or str(uuid.uuid4())
    device_info = event.get("device_info", {})
    if not isinstance(device_info, dict):
        device_info = {}

    # Build clean event
    event_id = event.get("event_id") or str(uuid.uuid4())
    timestamp = event.get("timestamp")
    if timestamp:
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                timestamp = datetime.now(timezone.utc)
        elif not isinstance(timestamp, datetime):
            timestamp = datetime.now(timezone.utc)
    else:
        timestamp = datetime.now(timezone.utc)

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


# ══════════════════════════════════════════════════════════════
# Deduplication
# ══════════════════════════════════════════════════════════════

_recent_event_ids: Dict[str, float] = {}


def _compute_dedup_key(event: Dict) -> str:
    """Create a fingerprint for dedup (user + type + metadata hash)."""
    raw = f"{event['user_id']}:{event['event_type']}:{event.get('metadata', {}).get('id', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def is_duplicate_event(event: Dict) -> bool:
    """Check if this event was recently ingested (within dedup window)."""
    # Check by event_id first (exact match)
    eid = event.get("event_id", "")
    now = datetime.now(timezone.utc).timestamp()

    # Clean old entries
    expired = [k for k, t in _recent_event_ids.items() if now - t > DEDUP_WINDOW_SECONDS]
    for k in expired:
        _recent_event_ids.pop(k, None)

    # Check Redis-based dedup if available
    dedup_key = _compute_dedup_key(event)
    cached = redis_client.cache_get(f"dedup:{dedup_key}")
    if cached:
        return True

    # Check memory dedup
    if eid in _recent_event_ids or dedup_key in _recent_event_ids:
        return True

    # Mark as seen
    _recent_event_ids[eid] = now
    _recent_event_ids[dedup_key] = now
    redis_client.cache_set(f"dedup:{dedup_key}", "1", ttl_seconds=DEDUP_WINDOW_SECONDS)

    # Bound memory
    if len(_recent_event_ids) > 50000:
        sorted_keys = sorted(_recent_event_ids, key=_recent_event_ids.get)
        for k in sorted_keys[:len(sorted_keys) // 2]:
            _recent_event_ids.pop(k, None)

    return False


# ══════════════════════════════════════════════════════════════
# Event Ingestion — Non-blocking pipeline
# ══════════════════════════════════════════════════════════════

def ingest_event(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point: validate → dedup → buffer → update counters.
    Returns the processed event or error.
    """
    try:
        # 1. Validate
        event = validate_event(raw_event)

        # 2. Dedup
        if is_duplicate_event(event):
            return {"status": "duplicate", "event_id": event["event_id"]}

        # 3. Buffer for batch write
        redis_client.buffer_event(event)

        # 4. Update real-time counters (non-blocking)
        _update_realtime_counters(event)

        # 5. Invalidate cached dashboard
        redis_client.invalidate_dashboard(event["user_id"])

        return {
            "status": "accepted",
            "event_id": event["event_id"],
            "event_type": event["event_type"],
        }

    except EventValidationError as e:
        logger.warning("Event validation failed: %s", str(e))
        return {"status": "rejected", "error": str(e)}
    except Exception as e:
        logger.error("Event ingestion error: %s", str(e), exc_info=True)
        return {"status": "error", "error": "Internal processing error"}


def ingest_batch(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Ingest a batch of events. Returns summary.
    More efficient than individual ingestion.
    """
    results = {"accepted": 0, "duplicates": 0, "rejected": 0, "errors": 0}
    for raw in events:
        result = ingest_event(raw)
        status = result.get("status", "error")
        if status == "accepted":
            results["accepted"] += 1
        elif status == "duplicate":
            results["duplicates"] += 1
        elif status == "rejected":
            results["rejected"] += 1
        else:
            results["errors"] += 1
    return results


# ── Real-time counter updates ─────────────────────────────────

def _update_realtime_counters(event: Dict):
    """Update Redis counters on every event (fast, atomic)."""
    user_id = event["user_id"]
    event_type = event["event_type"]

    # Increment daily activity
    redis_client.incr_daily_activity(user_id)

    # Track session state
    if event_type == "SESSION_START":
        redis_client.register_active_session(
            user_id, event["session_id"]
        )
    elif event_type == "SESSION_END":
        redis_client.end_active_session(event["session_id"])

    # Invalidate streak cache on activity events
    activity_events = {"PROBLEM_SOLVED", "QUIZ_COMPLETED", "FEATURE_USED", "CODE_EXECUTED"}
    if event_type in activity_events:
        redis_client.invalidate_streak_cache(user_id)


# ══════════════════════════════════════════════════════════════
# Event Persistence — Flush buffer to MongoDB
# ══════════════════════════════════════════════════════════════

def flush_to_database():
    """
    Flush the event buffer to MongoDB.
    Called by background worker at intervals.
    """
    events = redis_client.flush_event_buffer()
    if not events:
        return 0

    col = get_collection("pe_events")
    if col is None:
        logger.warning("MongoDB not available — %d events lost", len(events))
        return 0

    # Convert datetimes for MongoDB
    docs = []
    for e in events:
        doc = dict(e)
        if isinstance(doc.get("timestamp"), datetime):
            pass  # MongoDB handles datetime natively
        docs.append(doc)

    try:
        result = col.insert_many(docs, ordered=False)
        count = len(result.inserted_ids)
        logger.info("Flushed %d events to MongoDB.", count)
        return count
    except Exception as ex:
        logger.error("Failed to flush events to MongoDB: %s", str(ex))
        # Re-buffer the events so they're not lost
        for e in events:
            redis_client.buffer_event(e)
        return 0
