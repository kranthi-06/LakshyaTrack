"""
Progress Engine — Redis Cache & Real-Time Counter Layer
Provides atomic counters, streak caching, session tracking,
and buffered event ingestion for high-throughput writes.

Falls back gracefully to in-memory when Redis is unavailable.
"""
from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone, date, timedelta
from threading import Lock
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Redis Connection ──────────────────────────────────────────

_redis_client = None
_redis_init_attempted = False


def _get_redis():
    """Lazy-init Redis connection. Returns None on failure."""
    global _redis_client, _redis_init_attempted
    if _redis_client is not None:
        return _redis_client
    if _redis_init_attempted:
        return None
    _redis_init_attempted = True

    redis_url = (settings.REDIS_URL or "").strip()
    if not redis_url:
        logger.info("REDIS_URL not configured — using in-memory fallback for progress engine.")
        return None
    try:
        import redis
        _redis_client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        _redis_client.ping()
        logger.info("Progress Engine connected to Redis successfully.")
        return _redis_client
    except Exception as e:
        logger.warning("Redis connection failed (non-fatal): %s — using in-memory fallback.", str(e))
        _redis_client = None
        return None


# ── In-Memory Fallback ────────────────────────────────────────

_memory_store: Dict[str, Any] = {}
_memory_lock = Lock()
_memory_expiry: Dict[str, float] = {}


def _mem_get(key: str) -> Optional[str]:
    with _memory_lock:
        exp = _memory_expiry.get(key)
        if exp and time.time() > exp:
            _memory_store.pop(key, None)
            _memory_expiry.pop(key, None)
            return None
        return _memory_store.get(key)


def _mem_set(key: str, value: str, ex: Optional[int] = None):
    with _memory_lock:
        _memory_store[key] = value
        if ex:
            _memory_expiry[key] = time.time() + ex


def _mem_incr(key: str) -> int:
    with _memory_lock:
        val = int(_memory_store.get(key, 0)) + 1
        _memory_store[key] = str(val)
        return val


def _mem_delete(key: str):
    with _memory_lock:
        _memory_store.pop(key, None)
        _memory_expiry.pop(key, None)


# ══════════════════════════════════════════════════════════════
# PUBLIC API — Cache Operations
# ══════════════════════════════════════════════════════════════

PREFIX = "pe:"  # progress engine namespace


def cache_get(key: str) -> Optional[str]:
    """Get a cached value by key."""
    full_key = f"{PREFIX}{key}"
    r = _get_redis()
    if r:
        try:
            return r.get(full_key)
        except Exception:
            pass
    return _mem_get(full_key)


def cache_set(key: str, value: str, ttl_seconds: int = 300):
    """Set a cached value with TTL."""
    full_key = f"{PREFIX}{key}"
    r = _get_redis()
    if r:
        try:
            r.setex(full_key, ttl_seconds, value)
            return
        except Exception:
            pass
    _mem_set(full_key, value, ex=ttl_seconds)


def cache_delete(key: str):
    """Delete a cached value."""
    full_key = f"{PREFIX}{key}"
    r = _get_redis()
    if r:
        try:
            r.delete(full_key)
            return
        except Exception:
            pass
    _mem_delete(full_key)


def cache_json_get(key: str) -> Optional[Any]:
    """Get parsed JSON from cache."""
    raw = cache_get(key)
    if raw:
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def cache_json_set(key: str, data: Any, ttl_seconds: int = 300):
    """Cache a JSON-serializable object."""
    cache_set(key, json.dumps(data, default=str), ttl_seconds)


# ══════════════════════════════════════════════════════════════
# Atomic Counters — Daily activity, streaks, etc.
# ══════════════════════════════════════════════════════════════

def incr_daily_activity(user_id: str, date_str: str | None = None) -> int:
    """Atomically increment today's activity count for a user."""
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"daily:{user_id}:{date_str}"
    r = _get_redis()
    if r:
        try:
            val = r.incr(f"{PREFIX}{key}")
            r.expire(f"{PREFIX}{key}", 86400 * 3)  # keep for 3 days in cache
            return val
        except Exception:
            pass
    return _mem_incr(f"{PREFIX}{key}")


def get_daily_activity(user_id: str, date_str: str | None = None) -> int:
    """Get today's activity count for a user."""
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"daily:{user_id}:{date_str}"
    val = cache_get(key)
    return int(val) if val else 0


# ══════════════════════════════════════════════════════════════
# Session Tracking — Active sessions via Redis
# ══════════════════════════════════════════════════════════════

def register_active_session(user_id: str, session_id: str, ttl_seconds: int = 7200):
    """Mark a session as active."""
    cache_set(f"session:{session_id}", json.dumps({
        "user_id": user_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }), ttl_seconds)
    # Track user's active sessions
    cache_set(f"user_session:{user_id}", session_id, ttl_seconds)


def get_active_session(session_id: str) -> Optional[Dict]:
    """Get active session data."""
    return cache_json_get(f"session:{session_id}")


def end_active_session(session_id: str):
    """Remove session from active tracking."""
    session = cache_json_get(f"session:{session_id}")
    if session:
        cache_delete(f"user_session:{session['user_id']}")
    cache_delete(f"session:{session_id}")


# ══════════════════════════════════════════════════════════════
# Event Buffer — Batch writes for high throughput
# ══════════════════════════════════════════════════════════════

_event_buffer: List[Dict] = []
_buffer_lock = Lock()
BUFFER_MAX_SIZE = 100
BUFFER_FLUSH_INTERVAL = 10  # seconds
_last_flush_time = time.time()


def buffer_event(event: Dict):
    """Add event to the write buffer for the background flusher."""
    with _buffer_lock:
        _event_buffer.append(event)


def flush_event_buffer() -> List[Dict]:
    """Flush the event buffer and return events for DB write."""
    global _last_flush_time
    with _buffer_lock:
        events = list(_event_buffer)
        _event_buffer.clear()
        _last_flush_time = time.time()
    return events


def get_buffer_size() -> int:
    """Get current buffer size (for monitoring)."""
    with _buffer_lock:
        return len(_event_buffer)


# ══════════════════════════════════════════════════════════════
# Streak Cache — Fast streak lookups
# ══════════════════════════════════════════════════════════════

def cache_streak(user_id: str, streak_data: Dict):
    """Cache streak data for fast reads (TTL: 1 hour)."""
    cache_json_set(f"streak:{user_id}", streak_data, ttl_seconds=3600)


def get_cached_streak(user_id: str) -> Optional[Dict]:
    """Get cached streak data."""
    return cache_json_get(f"streak:{user_id}")


def invalidate_streak_cache(user_id: str):
    """Invalidate streak cache after update."""
    cache_delete(f"streak:{user_id}")


# ══════════════════════════════════════════════════════════════
# Dashboard Cache — Full precomputed dashboard
# ══════════════════════════════════════════════════════════════

DASHBOARD_CACHE_TTL = 600  # 10 minutes (frontend uses SWR with 24h client cache)

def cache_dashboard(user_id: str, dashboard_data: Dict):
    """Cache the full precomputed dashboard (TTL: 5 min)."""
    cache_json_set(f"dashboard:{user_id}", dashboard_data, ttl_seconds=DASHBOARD_CACHE_TTL)


def get_cached_dashboard(user_id: str) -> Optional[Dict]:
    """Get cached full dashboard."""
    return cache_json_get(f"dashboard:{user_id}")


def invalidate_dashboard(user_id: str):
    """Invalidate cached dashboard (called after new events)."""
    cache_delete(f"dashboard:{user_id}")


def invalidate_user_analytics(user_id: str):
    """Invalidate all per-user analytics caches touched by Progress Intelligence."""
    keys = [
        f"dashboard:{user_id}",
        f"streak:{user_id}",
        f"learning:{user_id}",
        f"activity:{user_id}",
        f"time:{user_id}",
        f"topics:{user_id}",
        f"badges:{user_id}",
        f"intel:{user_id}",
    ]
    current_year = datetime.now(timezone.utc).year
    for year in range(current_year - 2, current_year + 1):
        keys.append(f"contributions:{user_id}:{year}")

    for key in keys:
        cache_delete(key)
