"""
Progress Engine — Background Scheduler
Periodic background jobs for event flushing, daily aggregation,
and cache warming. Runs as a lightweight non-blocking scheduler.

Usage (in main.py startup):
    from app.progress_engine.scheduler import start_scheduler, stop_scheduler
    start_scheduler()  # on startup
    stop_scheduler()   # on shutdown
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_scheduler_thread: threading.Thread | None = None
_stop_event = threading.Event()

# Intervals in seconds
FLUSH_INTERVAL = 15       # Flush event buffer every 15s
AGGREGATE_INTERVAL = 300  # Run aggregation every 5min


def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    logger.info("Progress Engine scheduler started.")
    last_flush = time.time()
    last_aggregate = time.time()

    while not _stop_event.is_set():
        now = time.time()

        # 1. Event buffer flush
        if now - last_flush >= FLUSH_INTERVAL:
            try:
                from .workers import run_event_flusher
                result = run_event_flusher()
                flushed = result.get("flushed", 0)
                if flushed > 0:
                    logger.info("Scheduler: flushed %d events.", flushed)
            except Exception as e:
                logger.error("Scheduler flush error: %s", str(e))
            last_flush = now

        # 2. Periodic aggregation (for recently active users)
        if now - last_aggregate >= AGGREGATE_INTERVAL:
            try:
                _run_pending_aggregations()
            except Exception as e:
                logger.error("Scheduler aggregation error: %s", str(e))
            last_aggregate = now

        # Sleep for a short interval to avoid busy-waiting
        _stop_event.wait(timeout=5)

    logger.info("Progress Engine scheduler stopped.")


def _run_pending_aggregations():
    """Aggregate today's data for recently active users."""
    from app.db.mongodb import get_collection
    from .workers import run_daily_aggregation

    col = get_collection("pe_events")
    if col is None:
        return

    # Find users with recent events (last 10 minutes)
    cutoff = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    from datetime import timedelta
    cutoff -= timedelta(minutes=10)

    try:
        pipeline = [
            {"$match": {"timestamp": {"$gte": cutoff}}},
            {"$group": {"_id": "$user_id"}},
            {"$limit": 50},  # Cap to prevent overload
        ]
        active_users = [r["_id"] for r in col.aggregate(pipeline)]

        for uid in active_users:
            try:
                run_daily_aggregation(uid)
            except Exception:
                pass

        if active_users:
            logger.info("Scheduler: aggregated for %d active users.", len(active_users))
    except Exception as e:
        logger.error("Scheduler aggregation query error: %s", str(e))


def start_scheduler():
    """Start the background scheduler thread."""
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        logger.warning("Scheduler already running.")
        return

    _stop_event.clear()
    _scheduler_thread = threading.Thread(
        target=_scheduler_loop,
        name="progress-engine-scheduler",
        daemon=True,
    )
    _scheduler_thread.start()
    logger.info("Progress Engine background scheduler started.")


def stop_scheduler():
    """Stop the background scheduler thread."""
    global _scheduler_thread
    _stop_event.set()
    if _scheduler_thread:
        _scheduler_thread.join(timeout=10)
        _scheduler_thread = None
    logger.info("Progress Engine background scheduler stopped.")
