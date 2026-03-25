"""
Progress Engine — Analytics Processing Service
Background workers that precompute ALL analytics from raw events.

Strategy: NEVER compute on request. Precompute everything via workers.

Workers:
  1. Event Flusher — Flushes event buffer to DB
  2. Daily Aggregator — Computes daily_aggregates from events
  3. Streak Worker — Maintains streak state
  4. Badge Evaluator — Checks and unlocks achievements
  5. Intelligence Worker — Generates AI insights
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List, Optional

from app.db.mongodb import get_collection
from app.services.streak_service import touch_streak as legacy_touch_streak

from . import redis_client
from .events import flush_to_database

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# 1. EVENT FLUSHER — Periodic buffer drain
# ══════════════════════════════════════════════════════════════

def run_event_flusher():
    """Flush buffered events to MongoDB. Call every 10-30 seconds."""
    count = flush_to_database()
    return {"flushed": count}


# ══════════════════════════════════════════════════════════════
# 2. DAILY AGGREGATOR — Precompute daily roll-ups
# ══════════════════════════════════════════════════════════════

def run_daily_aggregation(user_id: str, target_date: Optional[date] = None):
    """
    Aggregate all events for a user on a given date into a daily summary.
    Writes to pe_daily_aggregates collection.
    """
    if target_date is None:
        target_date = datetime.now(timezone.utc).date()

    events_col = get_collection("pe_events")
    agg_col = get_collection("pe_daily_aggregates")
    if events_col is None or agg_col is None:
        return None

    start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    events = list(events_col.find({
        "user_id": user_id,
        "timestamp": {"$gte": start, "$lt": end},
    }))

    if not events:
        return None

    # Compute aggregates
    event_counts = Counter(e["event_type"] for e in events)
    pages_visited = Counter()
    features_used = Counter()
    problems_solved = 0
    quizzes_completed = 0
    total_active_minutes = 0
    session_ids = set()

    for e in events:
        etype = e["event_type"]
        meta = e.get("metadata", {})

        if etype == "PAGE_VISIT":
            pages_visited[meta.get("page", "unknown")] += 1
        elif etype == "FEATURE_USED":
            features_used[meta.get("feature", "unknown")] += 1
        elif etype == "PROBLEM_SOLVED":
            problems_solved += 1
        elif etype == "QUIZ_COMPLETED":
            quizzes_completed += 1

        if e.get("session_id"):
            session_ids.add(e["session_id"])

    # Session duration estimation
    sessions = _compute_session_durations(events)

    aggregate = {
        "user_id": user_id,
        "date": target_date.isoformat(),
        "total_events": len(events),
        "event_breakdown": dict(event_counts),
        "problems_solved": problems_solved,
        "quizzes_completed": quizzes_completed,
        "pages_visited": dict(pages_visited.most_common(20)),
        "features_used": dict(features_used.most_common(20)),
        "total_sessions": len(session_ids),
        "sessions": sessions,
        "total_active_minutes": sum(s.get("active_minutes", 0) for s in sessions),
        "total_idle_minutes": sum(s.get("idle_minutes", 0) for s in sessions),
        "computed_at": datetime.now(timezone.utc),
    }

    # Upsert
    agg_col.update_one(
        {"user_id": user_id, "date": target_date.isoformat()},
        {"$set": aggregate},
        upsert=True,
    )

    # Cache invalidation
    redis_client.invalidate_dashboard(user_id)

    return aggregate


def _compute_session_durations(events: List[Dict]) -> List[Dict]:
    """Compute session durations from SESSION_START/END pairs."""
    sessions_map: Dict[str, Dict] = {}

    for e in sorted(events, key=lambda x: x.get("timestamp", datetime.min)):
        sid = e.get("session_id")
        if not sid:
            continue

        if sid not in sessions_map:
            sessions_map[sid] = {
                "session_id": sid,
                "start": e.get("timestamp"),
                "end": None,
                "events": 0,
                "active_events": 0,
                "idle_events": 0,
            }

        s = sessions_map[sid]
        s["events"] += 1
        s["end"] = e.get("timestamp")

        if e["event_type"] == "ACTIVE":
            s["active_events"] += 1
        elif e["event_type"] == "IDLE":
            s["idle_events"] += 1

    result = []
    for s in sessions_map.values():
        duration_min = 0
        if s["start"] and s["end"]:
            diff = s["end"] - s["start"]
            if hasattr(diff, "total_seconds"):
                duration_min = diff.total_seconds() / 60

        active_ratio = max(0.5, s["active_events"] / max(1, s["active_events"] + s["idle_events"]))
        result.append({
            "session_id": s["session_id"],
            "duration_minutes": round(duration_min, 1),
            "active_minutes": round(duration_min * active_ratio, 1),
            "idle_minutes": round(duration_min * (1 - active_ratio), 1),
            "event_count": s["events"],
        })

    return result


# ══════════════════════════════════════════════════════════════
# 3. STREAK WORKER — Maintain streak from events
# ══════════════════════════════════════════════════════════════

def run_streak_update(user_id: str):
    """
    Update streak based on today's activity.
    Bridges to legacy streak_service + adds enhanced tracking.
    """
    # Touch the legacy streak service (MongoDB-based)
    streak_data = legacy_touch_streak(user_id)

    enhanced = {
        "current_streak": streak_data.get("current_streak", 0),
        "longest_streak": streak_data.get("longest_streak", 0),
        "last_active_date": streak_data.get("last_active_date"),
        "updated_at": streak_data.get("updated_at"),
        "today_activity": redis_client.get_daily_activity(user_id),
    }

    # Compute streak risk
    now = datetime.now(timezone.utc)
    hours_left = max(0, 24 - now.hour - (1 if now.minute > 0 else 0))
    enhanced["is_at_risk"] = hours_left < 6 and enhanced["current_streak"] > 0
    enhanced["hours_until_reset"] = hours_left
    enhanced["total_active_days"] = _count_active_days(user_id)

    # Weekly activity (last 7 days)
    weekly = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        count = redis_client.get_daily_activity(user_id, d)
        weekly.append(count)
    enhanced["weekly_activity"] = weekly

    # Cache
    redis_client.cache_streak(user_id, enhanced)

    return enhanced


def _count_active_days(user_id: str) -> int:
    """Count total active days from daily aggregates."""
    col = get_collection("pe_daily_aggregates")
    if col is None:
        return 0
    return col.count_documents({"user_id": user_id, "total_events": {"$gt": 0}})


# ══════════════════════════════════════════════════════════════
# 4. BADGE EVALUATOR — Check & unlock achievements
# ══════════════════════════════════════════════════════════════

# Badge definitions (rules engine)
BADGE_RULES = [
    {"id": "first_flame", "name": "First Flame", "icon": "🔥", "category": "streak", "rarity": "common",
     "description": "Maintain a 3-day streak", "check": lambda s: s.get("current_streak", 0) >= 3, "requirement_value": 3,
     "current_value_key": "current_streak"},
    {"id": "week_warrior", "name": "Week Warrior", "icon": "⚡", "category": "streak", "rarity": "common",
     "description": "Maintain a 7-day streak", "check": lambda s: s.get("current_streak", 0) >= 7, "requirement_value": 7,
     "current_value_key": "current_streak"},
    {"id": "fortnight_fighter", "name": "Fortnight Fighter", "icon": "💫", "category": "streak", "rarity": "rare",
     "description": "Maintain a 14-day streak", "check": lambda s: s.get("current_streak", 0) >= 14, "requirement_value": 14,
     "current_value_key": "current_streak"},
    {"id": "monthly_master", "name": "Monthly Master", "icon": "🌟", "category": "streak", "rarity": "epic",
     "description": "Maintain a 30-day streak", "check": lambda s: s.get("current_streak", 0) >= 30, "requirement_value": 30,
     "current_value_key": "current_streak"},
    {"id": "century_legend", "name": "Century Legend", "icon": "👑", "category": "streak", "rarity": "legendary",
     "description": "Maintain a 100-day streak", "check": lambda s: s.get("longest_streak", 0) >= 100, "requirement_value": 100,
     "current_value_key": "longest_streak"},
    {"id": "problem_starter", "name": "Problem Starter", "icon": "🎯", "category": "problems", "rarity": "common",
     "description": "Solve 10 problems", "check": lambda s: s.get("problems_solved", 0) >= 10, "requirement_value": 10,
     "current_value_key": "problems_solved"},
    {"id": "half_century", "name": "Half Century", "icon": "🏅", "category": "problems", "rarity": "common",
     "description": "Solve 50 problems", "check": lambda s: s.get("problems_solved", 0) >= 50, "requirement_value": 50,
     "current_value_key": "problems_solved"},
    {"id": "century_club", "name": "Century Club", "icon": "💎", "category": "problems", "rarity": "rare",
     "description": "Solve 100 problems", "check": lambda s: s.get("problems_solved", 0) >= 100, "requirement_value": 100,
     "current_value_key": "problems_solved"},
    {"id": "problem_slayer", "name": "Problem Slayer", "icon": "⚔️", "category": "problems", "rarity": "epic",
     "description": "Solve 250 problems", "check": lambda s: s.get("problems_solved", 0) >= 250, "requirement_value": 250,
     "current_value_key": "problems_solved"},
    {"id": "grandmaster", "name": "Grandmaster", "icon": "🏆", "category": "problems", "rarity": "legendary",
     "description": "Solve 500 problems", "check": lambda s: s.get("problems_solved", 0) >= 500, "requirement_value": 500,
     "current_value_key": "problems_solved"},
    {"id": "early_bird", "name": "Early Bird", "icon": "🌅", "category": "consistency", "rarity": "common",
     "description": "Log in before 7 AM", "check": lambda s: s.get("early_logins", 0) >= 1, "requirement_value": 1,
     "current_value_key": "early_logins"},
    {"id": "night_owl", "name": "Night Owl", "icon": "🦉", "category": "consistency", "rarity": "common",
     "description": "Active past midnight", "check": lambda s: s.get("late_sessions", 0) >= 1, "requirement_value": 1,
     "current_value_key": "late_sessions"},
    {"id": "speed_demon", "name": "Speed Demon", "icon": "⏱️", "category": "mastery", "rarity": "epic",
     "description": "Solve 5 problems in one session", "check": lambda s: s.get("max_problems_session", 0) >= 5,
     "requirement_value": 5, "current_value_key": "max_problems_session"},
]


def run_badge_evaluation(user_id: str, user_stats: Dict) -> Dict:
    """
    Evaluate all badge rules against user stats.
    Returns full badge state for the user.
    """
    badge_col = get_collection("pe_badges")
    if badge_col is None:
        return _badges_from_rules(user_stats)

    # Get existing badge state
    existing = {
        b["badge_id"]: b
        for b in badge_col.find({"user_id": user_id})
    }

    badges = []
    newly_unlocked = []
    now = datetime.now(timezone.utc)

    for rule in BADGE_RULES:
        bid = rule["id"]
        is_unlocked = rule["check"](user_stats)
        current_val = user_stats.get(rule["current_value_key"], 0)
        progress = min(100, round((current_val / max(1, rule["requirement_value"])) * 100))

        existing_badge = existing.get(bid)

        badge_doc = {
            "user_id": user_id,
            "badge_id": bid,
            "name": rule["name"],
            "icon": rule["icon"],
            "description": rule["description"],
            "category": rule["category"],
            "rarity": rule["rarity"],
            "is_unlocked": is_unlocked,
            "progress": progress,
            "current_value": current_val,
            "requirement_value": rule["requirement_value"],
        }

        # Handle new unlock
        if is_unlocked and (not existing_badge or not existing_badge.get("is_unlocked")):
            badge_doc["unlocked_at"] = now
            newly_unlocked.append(badge_doc)
        elif existing_badge and existing_badge.get("unlocked_at"):
            badge_doc["unlocked_at"] = existing_badge["unlocked_at"]
        else:
            badge_doc["unlocked_at"] = None

        badge_doc["updated_at"] = now

        # Upsert
        badge_col.update_one(
            {"user_id": user_id, "badge_id": bid},
            {"$set": badge_doc},
            upsert=True,
        )
        badges.append(badge_doc)

    unlocked_badges = [b for b in badges if b["is_unlocked"]]
    locked_badges = sorted([b for b in badges if not b["is_unlocked"]], key=lambda b: b["progress"], reverse=True)

    recently = sorted(
        [b for b in unlocked_badges if b.get("unlocked_at")],
        key=lambda b: b["unlocked_at"],
        reverse=True,
    )[:3]

    return {
        "badges": badges,
        "total_unlocked": len(unlocked_badges),
        "total_badges": len(badges),
        "recently_unlocked": recently,
        "next_to_unlock": locked_badges[0] if locked_badges else None,
        "newly_unlocked": newly_unlocked,
    }


def _badges_from_rules(user_stats: Dict) -> Dict:
    """Generate badge state in-memory when MongoDB is unavailable."""
    badges = []
    for rule in BADGE_RULES:
        current_val = user_stats.get(rule["current_value_key"], 0)
        is_unlocked = rule["check"](user_stats)
        badges.append({
            "badge_id": rule["id"], "name": rule["name"], "icon": rule["icon"],
            "description": rule["description"], "category": rule["category"],
            "rarity": rule["rarity"], "is_unlocked": is_unlocked,
            "progress": min(100, round((current_val / max(1, rule["requirement_value"])) * 100)),
            "current_value": current_val, "requirement_value": rule["requirement_value"],
            "unlocked_at": None,
        })
    unlocked = [b for b in badges if b["is_unlocked"]]
    return {"badges": badges, "total_unlocked": len(unlocked), "total_badges": len(badges),
            "recently_unlocked": [], "next_to_unlock": None, "newly_unlocked": []}
