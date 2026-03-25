"""
Progress Engine — Analytics Query Service
Precomputed data readers for all dashboard sections.

ALL reads go through cache → MongoDB. Never compute on request.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List, Optional

from app.db.mongodb import get_collection
from app.services.streak_service import get_streak as legacy_get_streak

from . import redis_client
from .workers import run_daily_aggregation, run_streak_update, run_badge_evaluation

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# 1. CONTRIBUTION HEATMAP
# ══════════════════════════════════════════════════════════════

def get_contributions(user_id: str, year: int) -> Dict:
    """Get 365-day contribution heatmap data. Cache-first."""
    cache_key = f"contributions:{user_id}:{year}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    col = get_collection("pe_daily_aggregates")
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    today = datetime.now(timezone.utc).date()

    contrib_map = {}
    if col is not None:
        docs = col.find({
            "user_id": user_id,
            "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        })
        for d in docs:
            contrib_map[d["date"]] = d.get("total_events", 0)

    contributions = []
    current = start
    total = 0
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    while current <= min(end, today):
        count = contrib_map.get(current.isoformat(), 0)
        level = 0 if count == 0 else (1 if count <= 2 else (2 if count <= 5 else (3 if count <= 8 else 4)))
        contributions.append({
            "date": current.isoformat(),
            "count": count,
            "level": level,
        })
        total += count
        if count > 0:
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0
        current += timedelta(days=1)

    # Current streak from today backwards
    current_streak = 0
    for c in reversed(contributions):
        if c["count"] > 0:
            current_streak += 1
        else:
            break

    result = {
        "contributions": contributions,
        "totalContributions": total,
        "longestStreak": longest_streak,
        "currentStreak": current_streak,
        "year": year,
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


# ══════════════════════════════════════════════════════════════
# 2. PROBLEM SOLVING ANALYTICS
# ══════════════════════════════════════════════════════════════

def get_problem_stats(user_id: str) -> Dict:
    """Get problem-solving analytics from aggregated data."""
    cache_key = f"problems:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    col = get_collection("pe_events")
    if col is None:
        return _empty_problem_stats()

    # Count problems solved by difficulty
    pipeline = [
        {"$match": {"user_id": user_id, "event_type": "PROBLEM_SOLVED"}},
        {"$group": {
            "_id": "$metadata.difficulty",
            "count": {"$sum": 1},
        }},
    ]
    difficulty_counts = {d["_id"]: d["count"] for d in col.aggregate(pipeline)}

    easy = difficulty_counts.get("easy", 0)
    medium = difficulty_counts.get("medium", 0)
    hard = difficulty_counts.get("hard", 0)
    total_solved = easy + medium + hard

    # Recent submissions
    recent = list(col.find(
        {"user_id": user_id, "event_type": "PROBLEM_SOLVED"},
        sort=[("timestamp", -1)],
        limit=15,
    ))

    # Total submission count (including failures)
    total_submissions = col.count_documents({
        "user_id": user_id,
        "event_type": {"$in": ["PROBLEM_SOLVED", "PROBLEM_ATTEMPTED"]},
    })
    total_submissions = max(total_submissions, total_solved)

    result = {
        "totalSolved": total_solved,
        "totalAvailable": 2850,
        "acceptanceRate": round((total_solved / max(total_submissions, 1)) * 100, 1),
        "totalSubmissions": total_submissions,
        "difficulty": {
            "easy": {"solved": easy, "total": 750},
            "medium": {"solved": medium, "total": 1500},
            "hard": {"solved": hard, "total": 600},
        },
        "recentSubmissions": [{
            "id": str(r.get("event_id", "")),
            "title": r.get("metadata", {}).get("title", "Unknown"),
            "difficulty": r.get("metadata", {}).get("difficulty", "medium"),
            "status": r.get("metadata", {}).get("status", "accepted"),
            "timestamp": r.get("timestamp", "").isoformat() if isinstance(r.get("timestamp"), datetime) else str(r.get("timestamp", "")),
            "language": r.get("metadata", {}).get("language", "Python"),
        } for r in recent],
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=300)
    return result


def _empty_problem_stats():
    return {
        "totalSolved": 0, "totalAvailable": 2850, "acceptanceRate": 0,
        "totalSubmissions": 0,
        "difficulty": {"easy": {"solved": 0, "total": 750}, "medium": {"solved": 0, "total": 1500}, "hard": {"solved": 0, "total": 600}},
        "recentSubmissions": [],
    }


# ══════════════════════════════════════════════════════════════
# 3. ACTIVITY SUMMARY
# ══════════════════════════════════════════════════════════════

def get_activity_summary(user_id: str) -> Dict:
    """Get activity tracking summary from daily aggregates."""
    cache_key = f"activity:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    col = get_collection("pe_daily_aggregates")
    if col is None:
        return _empty_activity()

    # Last 90 days of aggregates
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
    docs = list(col.find({"user_id": user_id, "date": {"$gte": cutoff}}))

    if not docs:
        return _empty_activity()

    total_sessions = sum(d.get("total_sessions", 0) for d in docs)
    total_active = sum(d.get("total_active_minutes", 0) for d in docs)
    total_idle = sum(d.get("total_idle_minutes", 0) for d in docs)
    active_days = len([d for d in docs if d.get("total_events", 0) > 0])

    # Aggregate page visits
    pages_counter = Counter()
    features_counter = Counter()
    for d in docs:
        for page, count in d.get("pages_visited", {}).items():
            pages_counter[page] += count
        for feat, count in d.get("features_used", {}).items():
            features_counter[feat] += count

    avg_duration = (total_active + total_idle) / max(total_sessions, 1)

    result = {
        "totalSessions": total_sessions,
        "avgSessionDuration": round(avg_duration, 1),
        "totalActiveTime": round(total_active, 1),
        "totalIdleTime": round(total_idle, 1),
        "mostVisitedPages": [{"page": p, "count": c} for p, c in pages_counter.most_common(6)],
        "mostUsedFeatures": [{"feature": f, "count": c} for f, c in features_counter.most_common(6)],
        "activeDays": active_days,
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=300)
    return result


def _empty_activity():
    return {
        "totalSessions": 0, "avgSessionDuration": 0, "totalActiveTime": 0, "totalIdleTime": 0,
        "mostVisitedPages": [], "mostUsedFeatures": [], "activeDays": 0,
    }


# ══════════════════════════════════════════════════════════════
# 4. TIME ANALYTICS
# ══════════════════════════════════════════════════════════════

def get_time_analytics(user_id: str) -> Dict:
    """Get time analytics from daily aggregates."""
    cache_key = f"time:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    col = get_collection("pe_daily_aggregates")
    if col is None:
        return _empty_time_analytics()

    # Last 30 days for daily chart
    cutoff_30 = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    docs_30 = list(col.find(
        {"user_id": user_id, "date": {"$gte": cutoff_30}},
        sort=[("date", 1)],
    ))

    # Last 12 weeks for weekly chart
    cutoff_84 = (datetime.now(timezone.utc) - timedelta(days=84)).date().isoformat()
    docs_84 = list(col.find(
        {"user_id": user_id, "date": {"$gte": cutoff_84}},
        sort=[("date", 1)],
    ))

    # Daily usage
    daily_usage = [{
        "date": d["date"],
        "totalMinutes": round(d.get("total_active_minutes", 0) + d.get("total_idle_minutes", 0), 1),
        "activeMinutes": round(d.get("total_active_minutes", 0), 1),
    } for d in docs_30]

    # Weekly trends
    weekly_map: Dict[int, List] = defaultdict(list)
    for d in docs_84:
        dt = date.fromisoformat(d["date"])
        week_num = dt.isocalendar()[1]
        total = d.get("total_active_minutes", 0) + d.get("total_idle_minutes", 0)
        weekly_map[week_num].append(total)

    weekly_trends = []
    for wk, mins_list in sorted(weekly_map.items()):
        total_hours = sum(mins_list) / 60
        weekly_trends.append({
            "week": f"W{wk}",
            "weekStart": "",
            "totalHours": round(total_hours, 1),
            "avgDailyMinutes": round(sum(mins_list) / max(len(mins_list), 1), 1),
        })

    # Feature time distribution
    features_col = get_collection("pe_events")
    feature_time = []
    if features_col is not None:
        feat_pipe = [
            {"$match": {"user_id": user_id, "event_type": "FEATURE_USED",
                         "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}}},
            {"$group": {"_id": "$metadata.feature", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 6},
        ]
        feat_results = list(features_col.aggregate(feat_pipe))
        total_feat = sum(f["count"] for f in feat_results) or 1
        colors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
        for i, f in enumerate(feat_results):
            pct = round(f["count"] / total_feat * 100)
            feature_time.append({
                "feature": f["_id"] or "Other",
                "minutes": f["count"] * 5,  # estimate 5 min per use
                "percentage": pct,
                "color": colors[i % len(colors)],
            })

    # Peak hour analysis
    peak_hour = 20
    peak_day = "Wednesday"
    if features_col is not None:
        hour_pipe = [
            {"$match": {"user_id": user_id,
                         "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}}},
            {"$group": {"_id": {"$hour": "$timestamp"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]
        hour_results = list(features_col.aggregate(hour_pipe))
        if hour_results:
            peak_hour = hour_results[0]["_id"]

        day_pipe = [
            {"$match": {"user_id": user_id,
                         "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}}},
            {"$group": {"_id": {"$dayOfWeek": "$timestamp"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]
        day_results = list(features_col.aggregate(day_pipe))
        day_names = {1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday",
                     5: "Thursday", 6: "Friday", 7: "Saturday"}
        if day_results:
            peak_day = day_names.get(day_results[0]["_id"], "Wednesday")

    # This week / this month totals
    today = datetime.now(timezone.utc).date()
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    month_start = today.replace(day=1).isoformat()

    this_week_mins = sum(
        d.get("total_active_minutes", 0) + d.get("total_idle_minutes", 0)
        for d in docs_30 if d["date"] >= week_start
    )
    this_month_mins = sum(
        d.get("total_active_minutes", 0) + d.get("total_idle_minutes", 0)
        for d in docs_30 if d["date"] >= month_start
    )

    result = {
        "dailyUsage": daily_usage,
        "weeklyTrends": weekly_trends[-12:],
        "featureTimeSpent": feature_time,
        "totalHoursThisWeek": round(this_week_mins / 60, 1),
        "totalHoursThisMonth": round(this_month_mins / 60, 1),
        "avgDailyMinutes": round(sum(d["totalMinutes"] for d in daily_usage) / max(len(daily_usage), 1), 1),
        "peakHour": peak_hour,
        "peakDay": peak_day,
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=300)
    return result


def _empty_time_analytics():
    return {
        "dailyUsage": [], "weeklyTrends": [], "featureTimeSpent": [],
        "totalHoursThisWeek": 0, "totalHoursThisMonth": 0, "avgDailyMinutes": 0,
        "peakHour": 20, "peakDay": "Wednesday",
    }


# ══════════════════════════════════════════════════════════════
# 5. TOPIC / SKILL MAP
# ══════════════════════════════════════════════════════════════

def get_topic_map(user_id: str) -> Dict:
    """Get skill bubble map from problem-solving events."""
    cache_key = f"topics:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    col = get_collection("pe_events")
    if col is None:
        return {"topics": [], "totalTopics": 0, "strongestTopic": "", "weakestTopic": ""}

    pipeline = [
        {"$match": {"user_id": user_id, "event_type": "PROBLEM_SOLVED"}},
        {"$group": {
            "_id": "$metadata.topic",
            "count": {"$sum": 1},
            "total_time": {"$sum": {"$ifNull": ["$metadata.time_taken_seconds", 300]}},
        }},
        {"$sort": {"count": -1}},
    ]

    results = list(col.aggregate(pipeline))
    if not results:
        return {"topics": [], "totalTopics": 0, "strongestTopic": "", "weakestTopic": ""}

    max_count = max(r["count"] for r in results)
    topic_categories = {
        "Arrays": "DSA", "Linked Lists": "DSA", "Trees": "DSA", "Graphs": "DSA",
        "Dynamic Programming": "DSA", "Sorting": "DSA", "Binary Search": "DSA",
        "Recursion": "DSA", "Hashing": "DSA", "Stack": "DSA", "Queue": "DSA",
        "React": "Web", "Node.js": "Web", "TypeScript": "Web", "HTML/CSS": "Web",
        "Python": "AI/ML", "Machine Learning": "AI/ML", "Deep Learning": "AI/ML",
        "SQL": "Database", "System Design": "Architecture", "OOP": "Fundamentals",
    }

    topics = []
    for i, r in enumerate(results):
        name = r["_id"] or "General"
        count = r["count"]
        time_minutes = r["total_time"] / 60
        proficiency = min(100, round((count / max(max_count, 1)) * 100))
        prof_level = "beginner" if proficiency < 30 else "intermediate" if proficiency < 55 else "advanced" if proficiency < 80 else "expert"

        topics.append({
            "id": f"topic-{i}",
            "name": name,
            "category": topic_categories.get(name, "General"),
            "problemsSolved": count,
            "timeSpentMinutes": round(time_minutes, 1),
            "proficiencyLevel": prof_level,
            "proficiencyScore": proficiency,
            "color": ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"][i % 6],
            "size": max(30, min(100, count * 2)),
        })

    result = {
        "topics": topics,
        "totalTopics": len(topics),
        "strongestTopic": topics[0]["name"] if topics else "",
        "weakestTopic": topics[-1]["name"] if topics else "",
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


# ══════════════════════════════════════════════════════════════
# 6. STREAK DATA
# ══════════════════════════════════════════════════════════════

def get_streak_data(user_id: str) -> Dict:
    """Get streak data. Cache → compute on miss."""
    cached = redis_client.get_cached_streak(user_id)
    if cached:
        return cached

    # Compute from legacy service + enhancements
    streak = run_streak_update(user_id)

    # Add streak history (last 30 days)
    col = get_collection("pe_daily_aggregates")
    history = []
    for i in range(29, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        active = False
        if col is not None:
            doc = col.find_one({"user_id": user_id, "date": d.isoformat()})
            active = doc is not None and doc.get("total_events", 0) > 0
        history.append({"date": d.isoformat(), "active": active})

    streak["streakHistory"] = history
    streak["lastActiveDate"] = streak.get("last_active_date")
    streak["currentStreak"] = streak.get("current_streak", 0)
    streak["longestStreak"] = streak.get("longest_streak", 0)
    streak["isAtRisk"] = streak.get("is_at_risk", False)
    streak["hoursUntilReset"] = streak.get("hours_until_reset", 24)
    streak["totalActiveDays"] = streak.get("total_active_days", 0)
    streak["weeklyActivity"] = streak.get("weekly_activity", [0] * 7)

    return streak


# ══════════════════════════════════════════════════════════════
# 7. BADGES
# ══════════════════════════════════════════════════════════════

def get_badges(user_id: str) -> Dict:
    """Get badge/achievement state."""
    cache_key = f"badges:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    # Build user stats for evaluation
    stats = _build_user_stats(user_id)
    result = run_badge_evaluation(user_id, stats)

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


def _build_user_stats(user_id: str) -> Dict:
    """Aggregate user stats for badge evaluation."""
    col = get_collection("pe_events")
    if col is None:
        return {}

    streak = legacy_get_streak(user_id)
    problems = col.count_documents({"user_id": user_id, "event_type": "PROBLEM_SOLVED"})

    return {
        "current_streak": streak.get("current_streak", 0),
        "longest_streak": streak.get("longest_streak", 0),
        "problems_solved": problems,
        "early_logins": 0,
        "late_sessions": 0,
        "max_problems_session": 0,
    }


# ══════════════════════════════════════════════════════════════
# 8. ACTIVITY TIMELINE (NEW FEATURE)
# ══════════════════════════════════════════════════════════════

def get_activity_timeline(
    user_id: str,
    filter_range: str = "today",
    page: int = 1,
    per_page: int = 20
) -> Dict:
    """
    Get chronological activity timeline with pagination.
    filter_range: today | week | month | all
    """
    col = get_collection("pe_events")
    if col is None:
        return {"events": [], "total": 0, "page": page, "per_page": per_page, "has_more": False}

    # Date filter
    now = datetime.now(timezone.utc)
    if filter_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif filter_range == "week":
        start = now - timedelta(days=7)
    elif filter_range == "month":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=365)

    query = {"user_id": user_id, "timestamp": {"$gte": start}}

    total = col.count_documents(query)
    skip = (page - 1) * per_page

    events = list(col.find(
        query,
        sort=[("timestamp", -1)],
        skip=skip,
        limit=per_page,
    ))

    # Format for frontend
    timeline = []
    for e in events:
        timeline.append({
            "id": str(e.get("event_id", e.get("_id", ""))),
            "type": e.get("event_type", ""),
            "timestamp": e["timestamp"].isoformat() if isinstance(e.get("timestamp"), datetime) else str(e.get("timestamp", "")),
            "metadata": e.get("metadata", {}),
            "description": _format_event_description(e),
            "icon": _get_event_icon(e.get("event_type", "")),
        })

    return {
        "events": timeline,
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (skip + per_page) < total,
    }


def _format_event_description(event: Dict) -> str:
    """Generate human-readable description for timeline."""
    etype = event.get("event_type", "")
    meta = event.get("metadata", {})

    descriptions = {
        "PROBLEM_SOLVED": f"Solved \"{meta.get('title', 'a problem')}\" ({meta.get('difficulty', 'medium')})",
        "QUIZ_COMPLETED": f"Completed \"{meta.get('quiz_name', 'a quiz')}\" — Score: {meta.get('score', 'N/A')}",
        "PAGE_VISIT": f"Visited {meta.get('page', 'a page')}",
        "FEATURE_USED": f"Used {meta.get('feature', 'a feature')}",
        "SESSION_START": "Started a session",
        "SESSION_END": "Ended session",
        "RESUME_ANALYZED": "Analyzed resume",
        "INTERVIEW_COMPLETED": f"Completed mock interview — {meta.get('position', '')}",
        "CODE_EXECUTED": f"Executed code in {meta.get('language', 'unknown')}",
        "BADGE_UNLOCKED": f"Unlocked badge: {meta.get('badge_name', '')}",
        "IDLE": "Went idle",
        "ACTIVE": "Became active",
    }

    return descriptions.get(etype, f"Activity: {etype}")


def _get_event_icon(event_type: str) -> str:
    icons = {
        "PROBLEM_SOLVED": "🧩", "QUIZ_COMPLETED": "📝", "PAGE_VISIT": "📄",
        "FEATURE_USED": "⚡", "SESSION_START": "🟢", "SESSION_END": "🔴",
        "RESUME_ANALYZED": "📄", "INTERVIEW_COMPLETED": "🎤", "CODE_EXECUTED": "💻",
        "BADGE_UNLOCKED": "🏆", "IDLE": "💤", "ACTIVE": "🟢",
        "ROADMAP_GENERATED": "🗺️", "STREAK_EXTENDED": "🔥",
    }
    return icons.get(event_type, "📌")


# ══════════════════════════════════════════════════════════════
# 9. AI INSIGHTS ENGINE
# ══════════════════════════════════════════════════════════════

def get_intelligence(user_id: str) -> Dict:
    """Generate AI-powered insights from user behavior patterns."""
    cache_key = f"intel:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    col = get_collection("pe_events")
    agg_col = get_collection("pe_daily_aggregates")

    insights = []
    active_hours = [{"hour": h, "activity": 0} for h in range(24)]
    consistency_score = 50
    growth_rate = 0
    predicted_streak_break = False
    suggested_focus = []

    if col is not None:
        # Peak activity hours
        hour_pipe = [
            {"$match": {"user_id": user_id,
                         "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}}},
            {"$group": {"_id": {"$hour": "$timestamp"}, "count": {"$sum": 1}}},
        ]
        for r in col.aggregate(hour_pipe):
            h = r["_id"]
            if 0 <= h < 24:
                active_hours[h]["activity"] = r["count"]

        peak = max(active_hours, key=lambda x: x["activity"])
        if peak["activity"] > 0:
            ph = peak["hour"]
            period = "morning" if ph < 12 else "afternoon" if ph < 17 else "evening" if ph < 21 else "night"
            insights.append({
                "id": "peak_hours", "type": "pattern",
                "title": f"{'Night Owl' if ph >= 20 else 'Early Bird' if ph < 9 else 'Steady Worker'} Pattern",
                "description": f"You are most active in the {period} (around {ph}:00). Peak productivity aligns with this time.",
                "icon": "🦉" if ph >= 20 else "🌅" if ph < 9 else "⏰",
                "priority": "medium", "actionable": False,
            })

        # Problem difficulty distribution insight
        diff_pipe = [
            {"$match": {"user_id": user_id, "event_type": "PROBLEM_SOLVED"}},
            {"$group": {"_id": "$metadata.difficulty", "count": {"$sum": 1}}},
        ]
        diff_counts = {r["_id"]: r["count"] for r in col.aggregate(diff_pipe)}
        easy = diff_counts.get("easy", 0)
        hard = diff_counts.get("hard", 0)
        if easy > 0 and hard < easy * 0.1:
            insights.append({
                "id": "hard_challenge", "type": "suggestion",
                "title": "Push Your Limits",
                "description": f"You've solved {easy} easy problems but only {hard} hard ones. Try more challenging problems to accelerate growth.",
                "icon": "🎯", "priority": "high", "actionable": True, "action": "Start a Hard Problem",
            })

        # Weak topics
        topic_pipe = [
            {"$match": {"user_id": user_id, "event_type": "PROBLEM_SOLVED"}},
            {"$group": {"_id": "$metadata.topic", "count": {"$sum": 1}}},
            {"$sort": {"count": 1}},
            {"$limit": 3},
        ]
        weak_topics = [r["_id"] for r in col.aggregate(topic_pipe) if r["_id"]]
        if weak_topics:
            suggested_focus = weak_topics
            insights.append({
                "id": "weak_areas", "type": "suggestion",
                "title": "Focus Areas Identified",
                "description": f"Your weakest topics are: {', '.join(weak_topics)}. Dedicated practice here could boost your overall score.",
                "icon": "🧠", "priority": "high", "actionable": True, "action": "Practice Weak Areas",
            })

    # Consistency score from aggregates
    if agg_col is not None:
        last_30_days = list(agg_col.find({
            "user_id": user_id,
            "date": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()},
        }))
        active_count = len([d for d in last_30_days if d.get("total_events", 0) > 0])
        consistency_score = min(100, round((active_count / 30) * 100))

        # Growth rate (compare last 2 weeks)
        week1 = [d for d in last_30_days
                 if d["date"] >= (datetime.now(timezone.utc) - timedelta(days=14)).date().isoformat()
                 and d["date"] < (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()]
        week2 = [d for d in last_30_days
                 if d["date"] >= (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()]
        w1_events = sum(d.get("total_events", 0) for d in week1)
        w2_events = sum(d.get("total_events", 0) for d in week2)
        if w1_events > 0:
            growth_rate = round(((w2_events - w1_events) / w1_events) * 100, 1)

        # Streak break prediction
        if active_count < 15:
            predicted_streak_break = True
            insights.append({
                "id": "streak_risk", "type": "warning",
                "title": "Streak at Risk",
                "description": f"Your consistency is below 50% ({active_count}/30 days). Try to practice daily!",
                "icon": "⚠️", "priority": "high", "actionable": True, "action": "Solve a Problem Now",
            })

    # Add achievement insight if consistency is high
    if consistency_score >= 70:
        insights.append({
            "id": "consistency_win", "type": "achievement",
            "title": "Consistency Champion!",
            "description": f"You've been active {consistency_score}% of the last 30 days. You're in the top tier of learners.",
            "icon": "🔥", "priority": "medium", "actionable": False,
        })

    # Growth prediction
    if growth_rate > 0:
        insights.append({
            "id": "growth", "type": "prediction",
            "title": "Growth Trajectory Rising",
            "description": f"Your activity increased by {growth_rate}% this week. Keep this momentum!",
            "icon": "📈", "priority": "low", "actionable": False,
        })

    result = {
        "insights": insights,
        "activeHours": active_hours,
        "consistencyScore": consistency_score,
        "growthRate": growth_rate,
        "predictedStreakBreak": predicted_streak_break,
        "suggestedFocusAreas": suggested_focus or ["Dynamic Programming", "Graph Algorithms", "System Design"],
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


# ══════════════════════════════════════════════════════════════
# 10. FULL DASHBOARD — Aggregated endpoint
# ══════════════════════════════════════════════════════════════

def get_full_dashboard(user_id: str) -> Dict:
    """
    Build full dashboard from cached/precomputed data.
    Single API call for all dashboard sections.
    """
    cached = redis_client.get_cached_dashboard(user_id)
    if cached:
        return cached

    year = datetime.now(timezone.utc).year

    dashboard = {
        "contributions": get_contributions(user_id, year),
        "problemSolving": get_problem_stats(user_id),
        "activity": get_activity_summary(user_id),
        "timeAnalytics": get_time_analytics(user_id),
        "topicMap": get_topic_map(user_id),
        "streak": get_streak_data(user_id),
        "badges": get_badges(user_id),
        "intelligence": get_intelligence(user_id),
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }

    redis_client.cache_dashboard(user_id, dashboard)
    return dashboard
