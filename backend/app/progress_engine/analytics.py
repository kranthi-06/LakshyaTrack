"""
Progress Engine — Analytics Query Service
Pulls REAL data from existing PostgreSQL tables + MongoDB collections.

Data Sources:
  - PostgreSQL: quiz_attempts, interview_sessions, multistage_interviews,
                roadmaps, progress_snapshots, saved_resumes, users
  - MongoDB: user_streaks, user_progress, pe_events, pe_daily_aggregates

NEVER returns generic/mock data. All queries hit real platform data.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func as sql_func, Integer
from sqlalchemy.orm import Session

from app.db.mongodb import get_collection
from app.db.session import SessionLocal
from app.models.career import (
    QuizAttempt, InterviewSession, MultiStageInterview,
    Roadmap, ProgressSnapshot, UserActivityDay,
)
from app.models.resume import SavedResume
from app.models.user import User, Profile
from app.services.streak_service import get_streak as legacy_get_streak

from . import redis_client
from .workers import run_streak_update, run_badge_evaluation

logger = logging.getLogger(__name__)


def _get_db() -> Session:
    """Get a database session."""
    return SessionLocal()


MEANINGFUL_ACTIVITY_EVENT_TYPES = frozenset({
    "PROBLEM_SOLVED",
    "CODE_EXECUTED",
})

FEATURE_EVENT_LABELS = {
    "QUIZ_COMPLETED": "Quizzes",
    "INTERVIEW_COMPLETED": "Mock Interviews",
    "ROADMAP_GENERATED": "Roadmaps",
    "RESUME_ANALYZED": "Resume Building",
    "PROBLEM_SOLVED": "Problem Solving",
    "CODE_EXECUTED": "Code Practice",
}


def _safe_utc_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _feature_from_page(page_name: Optional[str]) -> Optional[str]:
    page = (page_name or "").strip()
    if not page:
        return None

    lower = page.lower()
    if "quiz" in lower:
        return "Quizzes"
    if "interview" in lower:
        return "Mock Interviews"
    if "resume" in lower:
        return "Resume Building"
    if "career" in lower or "roadmap" in lower:
        return "Roadmaps"
    if "progress" in lower:
        return "Progress Dashboard"
    if "dashboard" in lower:
        return "Dashboard"
    if "learning" in lower:
        return "Learning Hub"
    if "english" in lower:
        return "English Coach"
    if "reasoning" in lower:
        return "Reasoning"
    if "job" in lower or "opportunit" in lower:
        return "Opportunities"
    return page


def _feature_from_event(event_type: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[str]:
    meta = metadata or {}
    if event_type == "PAGE_VISIT":
        return _feature_from_page(str(meta.get("page") or ""))
    if event_type == "FEATURE_USED":
        feature = str(meta.get("feature") or "").strip()
        return feature or None
    return FEATURE_EVENT_LABELS.get(event_type)


def _load_raw_events(
    user_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    event_types: Optional[set[str]] = None,
) -> List[Dict[str, Any]]:
    col = get_collection("pe_events")
    if col is None:
        return []

    query: Dict[str, Any] = {"user_id": user_id}
    if start or end:
        query["timestamp"] = {}
        if start is not None:
            query["timestamp"]["$gte"] = start
        if end is not None:
            query["timestamp"]["$lte"] = end
    if event_types:
        query["event_type"] = {"$in": sorted(event_types)}

    events = list(col.find(query, sort=[("timestamp", 1)]))
    return [event for event in events if _safe_utc_datetime(event.get("timestamp"))]


def _build_session_metrics(
    events: List[Dict[str, Any]],
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    current_time = now or datetime.now(timezone.utc)
    sessions_by_id: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for event in events:
        session_id = str(event.get("session_id") or event.get("event_id") or event.get("_id"))
        sessions_by_id[session_id].append(event)

    sessions: List[Dict[str, Any]] = []
    page_counts: Counter[str] = Counter()
    feature_counts: Counter[str] = Counter()
    feature_minutes: Dict[str, float] = defaultdict(float)
    active_hours: Counter[int] = Counter()
    active_dates: set[date] = set()
    daily_usage: Dict[str, Dict[str, float]] = defaultdict(lambda: {"totalMinutes": 0.0, "activeMinutes": 0.0})

    for session_id, session_events in sessions_by_id.items():
        sorted_events = sorted(
            session_events,
            key=lambda item: _safe_utc_datetime(item.get("timestamp")) or current_time,
        )
        timestamps = [_safe_utc_datetime(item.get("timestamp")) for item in sorted_events]
        timestamps = [ts for ts in timestamps if ts is not None]
        if not timestamps:
            continue

        start_time = timestamps[0]
        last_time = timestamps[-1]
        has_explicit_end = any((event.get("event_type") or "").upper() == "SESSION_END" for event in sorted_events)
        end_time = last_time
        if not has_explicit_end and (current_time - last_time) <= timedelta(minutes=15):
            end_time = current_time

        state = "active"
        cursor = start_time
        current_page: Optional[str] = None
        current_feature: Optional[str] = None
        active_minutes = 0.0
        idle_minutes = 0.0

        for index, event in enumerate(sorted_events):
            ts = _safe_utc_datetime(event.get("timestamp"))
            if ts is None:
                continue

            event_type = str(event.get("event_type") or "").upper()
            metadata = event.get("metadata") or {}

            if event_type != "IDLE":
                active_hours[ts.hour] += 1

            if event_type in FEATURE_EVENT_LABELS or event_type == "PAGE_VISIT":
                active_dates.add(ts.date())

            if index > 0 and ts > cursor:
                duration_minutes = (ts - cursor).total_seconds() / 60
                if state == "active":
                    active_minutes += duration_minutes
                    feature_label = current_feature or _feature_from_page(current_page) or "General"
                    feature_minutes[feature_label] += duration_minutes
                else:
                    idle_minutes += duration_minutes

            if event_type == "PAGE_VISIT":
                page_name = str(metadata.get("page") or "Unknown Page").strip() or "Unknown Page"
                page_counts[page_name] += 1
                current_page = page_name
                page_feature = _feature_from_page(page_name)
                if page_feature:
                    current_feature = page_feature
                    feature_counts[page_feature] += 1
                state = "active"
            else:
                feature_label = _feature_from_event(event_type, metadata)
                if feature_label:
                    feature_counts[feature_label] += 1
                    current_feature = feature_label

                if event_type == "IDLE":
                    state = "idle"
                elif event_type in {
                    "ACTIVE",
                    "SESSION_START",
                    "SESSION_END",
                    "FEATURE_USED",
                    *FEATURE_EVENT_LABELS.keys(),
                }:
                    state = "active"

            cursor = ts

        if end_time > cursor:
            duration_minutes = (end_time - cursor).total_seconds() / 60
            if state == "active":
                active_minutes += duration_minutes
                feature_label = current_feature or _feature_from_page(current_page) or "General"
                feature_minutes[feature_label] += duration_minutes
            else:
                idle_minutes += duration_minutes

        total_minutes = round(active_minutes + idle_minutes, 1)
        session_date = start_time.date().isoformat()
        daily_usage[session_date]["totalMinutes"] += total_minutes
        daily_usage[session_date]["activeMinutes"] += round(active_minutes, 1)
        active_dates.add(start_time.date())

        sessions.append({
            "session_id": session_id,
            "start": start_time,
            "end": end_time,
            "duration_minutes": total_minutes,
            "active_minutes": round(active_minutes, 1),
            "idle_minutes": round(idle_minutes, 1),
        })

    return {
        "sessions": sessions,
        "page_counts": page_counts,
        "feature_counts": feature_counts,
        "feature_minutes": feature_minutes,
        "active_hours": active_hours,
        "active_dates": active_dates,
        "daily_usage": daily_usage,
    }


def _get_meaningful_activity_counts(
    user_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> Dict[str, int]:
    activity_map: Dict[str, int] = defaultdict(int)
    db = _get_db()

    def _apply_time_filters(query, column):
        if start is not None:
            query = query.filter(column >= start)
        if end is not None:
            query = query.filter(column <= end)
        return query

    try:
        quiz_rows = _apply_time_filters(
            db.query(
                sql_func.date(QuizAttempt.attempted_at).label("d"),
                sql_func.count().label("c"),
            ).filter(QuizAttempt.user_id == user_id),
            QuizAttempt.attempted_at,
        ).group_by(sql_func.date(QuizAttempt.attempted_at)).all()

        interview_rows = _apply_time_filters(
            db.query(
                sql_func.date(InterviewSession.completed_at).label("d"),
                sql_func.count().label("c"),
            ).filter(InterviewSession.user_id == user_id),
            InterviewSession.completed_at,
        ).group_by(sql_func.date(InterviewSession.completed_at)).all()

        multistage_rows = _apply_time_filters(
            db.query(
                sql_func.date(MultiStageInterview.completed_at).label("d"),
                sql_func.count().label("c"),
            ).filter(
                MultiStageInterview.user_id == user_id,
                MultiStageInterview.is_completed == True,
                MultiStageInterview.completed_at.isnot(None),
            ),
            MultiStageInterview.completed_at,
        ).group_by(sql_func.date(MultiStageInterview.completed_at)).all()

        roadmap_rows = _apply_time_filters(
            db.query(
                sql_func.date(Roadmap.created_at).label("d"),
                sql_func.count().label("c"),
            ).filter(Roadmap.user_id == user_id),
            Roadmap.created_at,
        ).group_by(sql_func.date(Roadmap.created_at)).all()

        resume_rows = _apply_time_filters(
            db.query(
                sql_func.date(SavedResume.created_at).label("d"),
                sql_func.count().label("c"),
            ).filter(SavedResume.user_id == user_id),
            SavedResume.created_at,
        ).group_by(sql_func.date(SavedResume.created_at)).all()

        presence_rows = _apply_time_filters(
            db.query(
                sql_func.date(UserActivityDay.activity_date).label("d"),
            ).filter(UserActivityDay.user_id == user_id),
            UserActivityDay.activity_date,
        ).group_by(sql_func.date(UserActivityDay.activity_date)).all()
    finally:
        db.close()

    for rows in [quiz_rows, interview_rows, multistage_rows, roadmap_rows, resume_rows]:
        for row in rows:
            if row.d:
                activity_map[str(row.d)] += int(row.c or 0)

    for row in presence_rows:
        if row.d:
            activity_map[str(row.d)] = max(activity_map[str(row.d)], 1)

    event_rows = _load_raw_events(user_id, start=start, end=end, event_types=set(MEANINGFUL_ACTIVITY_EVENT_TYPES))
    for event in event_rows:
        ts = _safe_utc_datetime(event.get("timestamp"))
        if ts is not None:
            activity_map[ts.date().isoformat()] += 1

    return activity_map


def _compute_streak_metrics(user_id: str) -> Dict[str, Any]:
    counts = _get_meaningful_activity_counts(user_id)
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    active_dates = sorted(date.fromisoformat(day) for day, count in counts.items() if count > 0)

    longest_streak = 0
    running = 0
    previous_day: Optional[date] = None
    for active_day in active_dates:
        if previous_day and active_day == previous_day + timedelta(days=1):
            running += 1
        else:
            running = 1
        longest_streak = max(longest_streak, running)
        previous_day = active_day

    reference_day: Optional[date] = None
    if counts.get(today.isoformat(), 0) > 0:
        reference_day = today
    elif counts.get(yesterday.isoformat(), 0) > 0:
        reference_day = yesterday

    current_streak = 0
    while reference_day and counts.get(reference_day.isoformat(), 0) > 0:
        current_streak += 1
        reference_day -= timedelta(days=1)

    now = datetime.now(timezone.utc)
    hours_left = max(0, 24 - now.hour - (1 if now.minute > 0 else 0))

    streak_history = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        streak_history.append({
            "date": day.isoformat(),
            "active": counts.get(day.isoformat(), 0) > 0,
        })

    weekly_activity = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        weekly_activity.append(int(counts.get(day.isoformat(), 0)))

    last_active_date = active_dates[-1].isoformat() if active_dates else None

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_active_date": last_active_date,
        "is_at_risk": current_streak > 0 and counts.get(today.isoformat(), 0) == 0 and hours_left <= 6,
        "hours_until_reset": hours_left,
        "total_active_days": len(active_dates),
        "weekly_activity": weekly_activity,
        "streak_history": streak_history,
    }


# ══════════════════════════════════════════════════════════════
# 1. CONTRIBUTION HEATMAP — Real login/activity data
# ══════════════════════════════════════════════════════════════

def get_contributions(user_id: str, year: int) -> Dict:
    """Get 365-day activity heatmap from REAL user activity."""
    cache_key = f"contributions:{user_id}:{year}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    start_dt = datetime(year, 1, 1, tzinfo=timezone.utc)
    end_dt = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    activity_map = _get_meaningful_activity_counts(user_id, start=start_dt, end=end_dt)

    # Build contribution array
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)
    today = datetime.now(timezone.utc).date()

    contributions = []
    total = 0
    longest_streak = 0
    temp_streak = 0
    current = start_date

    while current <= min(end_date, today):
        count = activity_map.get(current.isoformat(), 0)
        level = 0 if count == 0 else (1 if count <= 2 else (2 if count <= 4 else (3 if count <= 7 else 4)))
        contributions.append({"date": current.isoformat(), "count": count, "level": level})
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
# 2. LEARNING ANALYTICS (replaces "Problem Solving")
# ══════════════════════════════════════════════════════════════

def get_problem_stats(user_id: str) -> Dict:
    """Get real quiz/problem submission analytics from production data sources."""
    cache_key = f"learning:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    db = _get_db()
    try:
        quizzes = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).all()
        total_quizzes = len(quizzes)
        quizzes_passed = sum(1 for q in quizzes if q.passed)
        recent_quizzes = db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_id
        ).order_by(QuizAttempt.attempted_at.desc()).limit(15).all()
    finally:
        db.close()

    problem_events = _load_raw_events(user_id, event_types={"PROBLEM_SOLVED"})
    direct_problem_submissions = len(problem_events)

    difficulty = {
        "easy": {"solved": 0, "total": 0},
        "medium": {"solved": 0, "total": 0},
        "hard": {"solved": 0, "total": 0},
    }

    def _normalize_quiz_difficulty(level: Optional[str]) -> str:
        normalized = (level or "").strip().lower()
        if normalized == "beginner":
            return "easy"
        if normalized == "advanced":
            return "hard"
        return "medium"

    for quiz in quizzes:
        bucket = _normalize_quiz_difficulty(quiz.level)
        difficulty[bucket]["total"] += 1
        if quiz.passed:
            difficulty[bucket]["solved"] += 1

    for event in problem_events:
        metadata = event.get("metadata") or {}
        bucket = str(metadata.get("difficulty") or "medium").strip().lower()
        if bucket not in difficulty:
            bucket = "medium"
        difficulty[bucket]["total"] += 1
        difficulty[bucket]["solved"] += 1

    recent_submissions = []
    for q in recent_quizzes:
        recent_submissions.append({
            "id": str(q.id),
            "title": f"Quiz: {q.skill_name}",
            "difficulty": _normalize_quiz_difficulty(q.level),
            "status": "accepted" if q.passed else "wrong_answer",
            "timestamp": q.attempted_at.isoformat() if q.attempted_at else "",
            "language": f"Score {round(q.score or 0)}%",
        })

    recent_problem_events = sorted(
        problem_events,
        key=lambda item: _safe_utc_datetime(item.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )[:15]
    for event in recent_problem_events:
        metadata = event.get("metadata") or {}
        ts = _safe_utc_datetime(event.get("timestamp"))
        raw_difficulty = str(metadata.get("difficulty") or "medium").strip().lower()
        problem_difficulty = raw_difficulty if raw_difficulty in difficulty else "medium"
        recent_submissions.append({
            "id": str(event.get("event_id") or event.get("_id")),
            "title": str(metadata.get("title") or metadata.get("topic") or "Solved Problem"),
            "difficulty": problem_difficulty,
            "status": "accepted",
            "timestamp": ts.isoformat() if ts else "",
            "language": str(metadata.get("language") or "Practice"),
        })
    recent_submissions.sort(key=lambda x: x["timestamp"], reverse=True)

    total_submissions = total_quizzes + direct_problem_submissions
    total_solved = quizzes_passed + direct_problem_submissions

    result = {
        "totalSolved": total_solved,
        "totalAvailable": total_submissions,
        "acceptanceRate": round((total_solved / max(total_submissions, 1)) * 100, 1),
        "totalSubmissions": total_submissions,
        "difficulty": difficulty,
        "recentSubmissions": recent_submissions[:15],
        "_platform": {
            "quizzes": {"total": total_quizzes, "passed": quizzes_passed},
            "problems": {"total": direct_problem_submissions, "solved": direct_problem_submissions},
        },
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=300)
    return result


# ══════════════════════════════════════════════════════════════
# 3. ACTIVITY SUMMARY — Real platform usage
# ══════════════════════════════════════════════════════════════

def get_activity_summary(user_id: str) -> Dict:
    """Get activity summary from real tracked session and page data."""
    cache_key = f"activity:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    events = _load_raw_events(user_id)
    metrics = _build_session_metrics(events)
    sessions = metrics["sessions"]
    durations = [session["duration_minutes"] for session in sessions if session["duration_minutes"] > 0]
    total_active = round(sum(session["active_minutes"] for session in sessions), 1)
    total_idle = round(sum(session["idle_minutes"] for session in sessions), 1)

    page_visits = [
        {"page": page, "count": count}
        for page, count in metrics["page_counts"].most_common(6)
    ]
    feature_usage = [
        {"feature": feature, "count": count}
        for feature, count in metrics["feature_counts"].most_common(6)
    ]

    result = {
        "totalSessions": len(sessions),
        "avgSessionDuration": round(sum(durations) / len(durations), 1) if durations else 0,
        "totalActiveTime": total_active,
        "totalIdleTime": total_idle,
        "mostVisitedPages": page_visits,
        "mostUsedFeatures": feature_usage,
        "activeDays": len(metrics["active_dates"]),
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=300)
    return result


# ══════════════════════════════════════════════════════════════
# 4. TIME ANALYTICS — From real data
# ══════════════════════════════════════════════════════════════

def get_time_analytics(user_id: str) -> Dict:
    """Get time analytics from real session/page activity."""
    cache_key = f"time:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)
    metrics = _build_session_metrics(_load_raw_events(user_id, start=cutoff_30), now=now)

    daily_usage = []
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        usage = metrics["daily_usage"].get(day, {"totalMinutes": 0.0, "activeMinutes": 0.0})
        daily_usage.append({
            "date": day,
            "totalMinutes": round(usage["totalMinutes"], 1),
            "activeMinutes": round(usage["activeMinutes"], 1),
        })

    weekly_map: Dict[tuple[int, int], Dict[str, float]] = defaultdict(lambda: {"minutes": 0.0, "days": 0})
    for entry in daily_usage:
        d_str = entry["date"]
        mins = entry["totalMinutes"]
        dt = date.fromisoformat(d_str)
        week_key = (dt.isocalendar()[0], dt.isocalendar()[1])
        weekly_map[week_key]["minutes"] += mins
        weekly_map[week_key]["days"] += 1

    weekly_trends = []
    for (iso_year, week_number), info in sorted(weekly_map.items()):
        week_start = date.fromisocalendar(iso_year, week_number, 1)
        weekly_trends.append({
            "week": f"W{week_number}",
            "weekStart": week_start.isoformat(),
            "totalHours": round(info["minutes"] / 60, 1),
            "avgDailyMinutes": round(info["minutes"] / max(info["days"], 1), 1),
        })

    feature_color_map = {
        "Quizzes": "#10b981",
        "Mock Interviews": "#6366f1",
        "Resume Building": "#8b5cf6",
        "Roadmaps": "#ef4444",
        "Progress Dashboard": "#06b6d4",
        "Code Practice": "#f59e0b",
        "Problem Solving": "#f97316",
        "Dashboard": "#14b8a6",
        "Learning Hub": "#3b82f6",
        "English Coach": "#ec4899",
        "Reasoning": "#a855f7",
        "Opportunities": "#0ea5e9",
    }
    total_feature_time = sum(metrics["feature_minutes"].values())
    feature_time_spent = []
    for feature, minutes in sorted(metrics["feature_minutes"].items(), key=lambda item: item[1], reverse=True):
        rounded_minutes = round(minutes, 1)
        if rounded_minutes <= 0:
            continue
        feature_time_spent.append({
            "feature": feature,
            "minutes": rounded_minutes,
            "percentage": round((rounded_minutes / total_feature_time) * 100) if total_feature_time > 0 else 0,
            "color": feature_color_map.get(feature, "#94a3b8"),
        })

    this_week_mins = sum(d["totalMinutes"] for d in daily_usage[-7:])
    this_month_mins = sum(d["totalMinutes"] for d in daily_usage)

    peak_hour = 0
    if metrics["active_hours"]:
        peak_hour = max(metrics["active_hours"], key=metrics["active_hours"].get)

    day_totals: Dict[int, float] = defaultdict(float)
    for entry in daily_usage:
        dt = date.fromisoformat(entry["date"])
        day_totals[dt.weekday()] += entry["totalMinutes"]
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    peak_day = day_names[max(day_totals, key=day_totals.get)] if day_totals and sum(day_totals.values()) > 0 else "No activity yet"

    result = {
        "dailyUsage": daily_usage,
        "weeklyTrends": weekly_trends[-12:],
        "featureTimeSpent": feature_time_spent,
        "totalHoursThisWeek": round(this_week_mins / 60, 1),
        "totalHoursThisMonth": round(this_month_mins / 60, 1),
        "avgDailyMinutes": round(this_month_mins / 30, 1),
        "peakHour": peak_hour,
        "peakDay": peak_day,
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=300)
    return result


def _compute_peak_hour(user_id: str) -> int:
    """Find the hour with most activity from real quiz/interview timestamps."""
    db = _get_db()
    try:
        hour_counts: Dict[int, int] = defaultdict(int)
        quizzes = db.query(QuizAttempt.attempted_at).filter(
            QuizAttempt.user_id == user_id
        ).all()
        for (ts,) in quizzes:
            if ts:
                hour_counts[ts.hour] += 1

        interviews = db.query(InterviewSession.completed_at).filter(
            InterviewSession.user_id == user_id
        ).all()
        for (ts,) in interviews:
            if ts:
                hour_counts[ts.hour] += 1
    finally:
        db.close()

    if not hour_counts:
        return 20  # default if no data
    return max(hour_counts, key=hour_counts.get)


def _compute_peak_day(daily_map: Dict[str, int]) -> str:
    """Find the day of week with most activity minutes."""
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_totals: Dict[int, int] = defaultdict(int)
    for d_str, mins in daily_map.items():
        try:
            dt = date.fromisoformat(d_str)
            day_totals[dt.weekday()] += mins
        except (ValueError, TypeError):
            continue
    if not day_totals:
        return "Not enough data"
    peak_idx = max(day_totals, key=day_totals.get)
    return day_names[peak_idx]


# ══════════════════════════════════════════════════════════════
# 5. SKILL MAP — From REAL quiz topics
# ══════════════════════════════════════════════════════════════

def get_topic_map(user_id: str) -> Dict:
    """Skill bubble map from real topic-wise quiz/problem activity."""
    cache_key = f"topics:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    db = _get_db()
    try:
        # Group quizzes by skill_name
        skill_stats = db.query(
            QuizAttempt.skill_name,
            sql_func.count().label("attempts"),
            sql_func.avg(QuizAttempt.score).label("avg_score"),
            sql_func.sum(sql_func.cast(QuizAttempt.passed, Integer)).label("passed"),
        ).filter(
            QuizAttempt.user_id == user_id,
        ).group_by(QuizAttempt.skill_name).all()
    finally:
        db.close()

    colors = ['#6366f1', '#a855f7', '#7c3aed', '#06b6d4', '#0891b2',
              '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']

    topic_metrics: Dict[str, Dict[str, Any]] = {}
    for s in skill_stats:
        if not s.skill_name:
            continue
        topic_metrics[s.skill_name] = {
            "attempts": int(s.attempts or 0),
            "score_sum": float((s.avg_score or 0) * (s.attempts or 0)),
            "score_count": int(s.attempts or 0),
            "problems_solved": int(s.passed or 0),
            "time_spent_minutes": 0.0,
        }

    for event in _load_raw_events(user_id, event_types={"PROBLEM_SOLVED"}):
        metadata = event.get("metadata") or {}
        topic_name = str(metadata.get("topic") or metadata.get("title") or "General").strip()
        if not topic_name:
            topic_name = "General"
        metrics = topic_metrics.setdefault(topic_name, {
            "attempts": 0,
            "score_sum": 0.0,
            "score_count": 0,
            "problems_solved": 0,
            "time_spent_minutes": 0.0,
        })
        metrics["attempts"] += 1
        metrics["score_sum"] += 100.0
        metrics["score_count"] += 1
        metrics["problems_solved"] += 1
        if metadata.get("time_taken_seconds") is not None:
            metrics["time_spent_minutes"] += max(float(metadata.get("time_taken_seconds") or 0) / 60, 0.0)

    topics = []
    max_activity = max(
        (max(metric["attempts"], metric["problems_solved"], 1) for metric in topic_metrics.values()),
        default=1,
    )

    for i, (topic_name, metric) in enumerate(topic_metrics.items()):
        avg = round(metric["score_sum"] / max(metric["score_count"], 1), 1) if metric["score_count"] > 0 else 0.0
        prof = min(100, round(avg))
        prof_level = "beginner" if prof < 40 else "intermediate" if prof < 60 else "advanced" if prof < 80 else "expert"

        topics.append({
            "id": f"topic-{i}",
            "name": topic_name,
            "category": _categorize_skill(topic_name),
            "problemsSolved": metric["problems_solved"],
            "timeSpentMinutes": round(metric["time_spent_minutes"], 1),
            "proficiencyLevel": prof_level,
            "proficiencyScore": prof,
            "color": colors[i % len(colors)],
            "size": max(30, min(100, int(max(metric["attempts"], metric["problems_solved"], 1) / max_activity * 100))),
        })

    sorted_topics = sorted(topics, key=lambda t: t["proficiencyScore"], reverse=True)

    result = {
        "topics": sorted_topics,
        "totalTopics": len(sorted_topics),
        "strongestTopic": sorted_topics[0]["name"] if sorted_topics else "",
        "weakestTopic": sorted_topics[-1]["name"] if sorted_topics else "",
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


def _categorize_skill(name: str) -> str:
    """Auto-categorize skills for the bubble map."""
    name_lower = name.lower()
    if any(k in name_lower for k in ["python", "java", "c++", "javascript", "typescript", "react", "node", "html", "css"]):
        return "Programming"
    if any(k in name_lower for k in ["sql", "database", "mongodb", "postgresql", "redis"]):
        return "Database"
    if any(k in name_lower for k in ["machine learning", "deep learning", "ai", "data science", "nlp"]):
        return "AI/ML"
    if any(k in name_lower for k in ["system design", "architecture", "devops", "cloud", "docker", "kubernetes"]):
        return "Infrastructure"
    if any(k in name_lower for k in ["communication", "aptitude", "reasoning", "english", "verbal"]):
        return "Soft Skills"
    if any(k in name_lower for k in ["resume", "interview", "career", "networking"]):
        return "Career"
    return "Technical"





# ══════════════════════════════════════════════════════════════
# 6. STREAK DATA — From real MongoDB streaks
# ══════════════════════════════════════════════════════════════

def get_streak_data(user_id: str) -> Dict:
    """Get streak data computed from real activity dates."""
    cached = redis_client.get_cached_streak(user_id)
    if cached:
        return cached

    streak = _compute_streak_metrics(user_id)
    streak["streakHistory"] = streak.get("streak_history", [])
    streak["lastActiveDate"] = streak.get("last_active_date")
    streak["currentStreak"] = streak.get("current_streak", 0)
    streak["longestStreak"] = streak.get("longest_streak", 0)
    streak["isAtRisk"] = streak.get("is_at_risk", False)
    streak["hoursUntilReset"] = streak.get("hours_until_reset", 24)
    streak["totalActiveDays"] = streak.get("total_active_days", 0)
    streak["weeklyActivity"] = streak.get("weekly_activity", [0] * 7)

    redis_client.cache_streak(user_id, streak)

    return streak


# ══════════════════════════════════════════════════════════════
# 7. BADGES — Platform achievements
# ══════════════════════════════════════════════════════════════

def get_badges(user_id: str) -> Dict:
    """Get badge state from REAL platform data."""
    cache_key = f"badges:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    stats = _build_user_stats(user_id)
    result = run_badge_evaluation(user_id, stats)

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


def _build_user_stats(user_id: str) -> Dict:
    """Aggregate REAL user stats for badge evaluation."""
    db = _get_db()
    try:
        quizzes = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).count()
        quizzes_passed = db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_id, QuizAttempt.passed == True
        ).count()
        interviews = db.query(InterviewSession).filter(InterviewSession.user_id == user_id).count()
        ms_interviews = db.query(MultiStageInterview).filter(
            MultiStageInterview.user_id == user_id, MultiStageInterview.is_completed == True
        ).count()
        roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).count()
        resumes = db.query(SavedResume).filter(SavedResume.user_id == user_id).count()
    finally:
        db.close()

    streak = _compute_streak_metrics(user_id)

    return {
        "current_streak": streak.get("current_streak", 0),
        "longest_streak": streak.get("longest_streak", 0),
        "problems_solved": quizzes_passed + interviews + ms_interviews,
        "quizzes_total": quizzes,
        "quizzes_passed": quizzes_passed,
        "interviews_done": interviews + ms_interviews,
        "roadmaps_created": roadmaps,
        "resumes_built": resumes,
        "early_logins": 0,
        "late_sessions": 0,
        "max_problems_session": 0,
    }


# ══════════════════════════════════════════════════════════════
# 8. ACTIVITY TIMELINE
# ══════════════════════════════════════════════════════════════

def get_activity_timeline(
    user_id: str,
    filter_range: str = "today",
    page: int = 1,
    per_page: int = 20,
) -> Dict:
    """Get chronological timeline from REAL events + PostgreSQL data."""
    # Get events from MongoDB
    col = get_collection("pe_events")
    timeline = []

    now = datetime.now(timezone.utc)
    if filter_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif filter_range == "week":
        start = now - timedelta(days=7)
    elif filter_range == "month":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=365)

    if col is not None:
        query = {"user_id": user_id, "timestamp": {"$gte": start}}
        total = col.count_documents(query)
        skip = (page - 1) * per_page
        events = list(col.find(query, sort=[("timestamp", -1)], skip=skip, limit=per_page))
        for e in events:
            timeline.append({
                "id": str(e.get("event_id", e.get("_id", ""))),
                "type": e.get("event_type", ""),
                "timestamp": e["timestamp"].isoformat() if isinstance(e.get("timestamp"), datetime) else str(e.get("timestamp", "")),
                "metadata": e.get("metadata", {}),
                "description": _format_event(e),
                "icon": _get_icon(e.get("event_type", "")),
            })
    else:
        total = 0

    # If no tracked events yet, build from PostgreSQL
    if total == 0 and page == 1:
        db = _get_db()
        try:
            quizzes = db.query(QuizAttempt).filter(
                QuizAttempt.user_id == user_id, QuizAttempt.attempted_at >= start,
            ).order_by(QuizAttempt.attempted_at.desc()).limit(per_page).all()

            for q in quizzes:
                timeline.append({
                    "id": str(q.id), "type": "QUIZ_COMPLETED",
                    "timestamp": q.attempted_at.isoformat() if q.attempted_at else "",
                    "metadata": {"skill_name": q.skill_name, "score": q.score, "passed": q.passed},
                    "description": f"{'✅ Passed' if q.passed else '❌ Failed'} Quiz: {q.skill_name} — Score: {q.score}%",
                    "icon": "📝",
                })

            interviews = db.query(InterviewSession).filter(
                InterviewSession.user_id == user_id, InterviewSession.completed_at >= start,
            ).order_by(InterviewSession.completed_at.desc()).limit(10).all()

            for iv in interviews:
                timeline.append({
                    "id": str(iv.id), "type": "INTERVIEW_COMPLETED",
                    "timestamp": iv.completed_at.isoformat() if iv.completed_at else "",
                    "metadata": {"position": iv.position, "score": iv.technical_score},
                    "description": f"Completed interview for {iv.position} — Score: {iv.technical_score or 'N/A'}",
                    "icon": "🎤",
                })

            total = len(timeline)
            timeline.sort(key=lambda x: x["timestamp"], reverse=True)
        finally:
            db.close()

    return {
        "events": timeline,
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (page * per_page) < total,
    }


def _format_event(event: Dict) -> str:
    etype = event.get("event_type", "")
    meta = event.get("metadata", {})
    desc = {
        "QUIZ_COMPLETED": f"Completed quiz: {meta.get('quiz_name', meta.get('skill_name', 'Unknown'))} — Score: {meta.get('score', 'N/A')}",
        "PAGE_VISIT": f"Visited {meta.get('page', 'a page')}",
        "FEATURE_USED": f"Used {meta.get('feature', 'a feature')}",
        "SESSION_START": "Logged in — session started",
        "SESSION_END": "Session ended",
        "RESUME_ANALYZED": "Analyzed resume",
        "INTERVIEW_COMPLETED": f"Completed mock interview: {meta.get('position', '')}",
        "ROADMAP_GENERATED": "Generated a learning roadmap",
        "IDLE": "Went idle",
        "ACTIVE": "Became active",
    }
    return desc.get(etype, f"Activity: {etype}")


def _get_icon(event_type: str) -> str:
    icons = {
        "QUIZ_COMPLETED": "📝", "PAGE_VISIT": "📄", "FEATURE_USED": "⚡",
        "SESSION_START": "🟢", "SESSION_END": "🔴", "RESUME_ANALYZED": "📄",
        "INTERVIEW_COMPLETED": "🎤", "ROADMAP_GENERATED": "🗺️",
        "BADGE_UNLOCKED": "🏆", "IDLE": "💤", "ACTIVE": "🟢", "STREAK_EXTENDED": "🔥",
    }
    return icons.get(event_type, "📌")


# ══════════════════════════════════════════════════════════════
# 9. AI INSIGHTS — From real patterns
# ══════════════════════════════════════════════════════════════

def get_intelligence(user_id: str) -> Dict:
    """Generate insights from REAL user data."""
    cache_key = f"intel:{user_id}"
    cached = redis_client.cache_json_get(cache_key)
    if cached:
        return cached

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    db = _get_db()
    try:
        quiz_count = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).count()
        quizzes_passed = db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_id, QuizAttempt.passed == True
        ).count()
        quiz_avg = 0.0
        if quiz_count > 0:
            result = db.query(sql_func.avg(QuizAttempt.score)).filter(QuizAttempt.user_id == user_id).scalar()
            quiz_avg = float(result) if result else 0.0

        interview_count = db.query(InterviewSession).filter(InterviewSession.user_id == user_id).count()
        roadmap_count = db.query(Roadmap).filter(Roadmap.user_id == user_id).count()
        resume_count = db.query(SavedResume).filter(SavedResume.user_id == user_id).count()

        recent_quiz_avg_raw = db.query(sql_func.avg(QuizAttempt.score)).filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.attempted_at >= thirty_days_ago,
        ).scalar()
        previous_quiz_avg_raw = db.query(sql_func.avg(QuizAttempt.score)).filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.attempted_at >= sixty_days_ago,
            QuizAttempt.attempted_at < thirty_days_ago,
        ).scalar()

        # Weak quiz topics
        weak_skills = db.query(
            QuizAttempt.skill_name,
            sql_func.avg(QuizAttempt.score).label("avg"),
        ).filter(
            QuizAttempt.user_id == user_id,
        ).group_by(QuizAttempt.skill_name).having(
            sql_func.avg(QuizAttempt.score) < 60
        ).order_by(sql_func.avg(QuizAttempt.score)).limit(3).all()

    finally:
        db.close()

    streak = _compute_streak_metrics(user_id)
    current_str = streak.get("current_streak", 0)
    last_active_today = streak.get("last_active_date") == now.date().isoformat()
    active_days_last_30 = sum(1 for entry in streak.get("streak_history", []) if entry.get("active"))
    consistency = round((active_days_last_30 / 30) * 100) if streak.get("streak_history") else 0

    recent_quiz_avg = float(recent_quiz_avg_raw or 0)
    previous_quiz_avg = float(previous_quiz_avg_raw or 0)
    growth_rate = round(recent_quiz_avg - previous_quiz_avg, 1) if previous_quiz_avg > 0 else 0.0

    active_hour_counts = Counter()
    for event in _load_raw_events(user_id, start=thirty_days_ago):
        ts = _safe_utc_datetime(event.get("timestamp"))
        if ts and str(event.get("event_type") or "").upper() != "IDLE":
            active_hour_counts[ts.hour] += 1

    if not active_hour_counts:
        db = _get_db()
        try:
            for (timestamp,) in db.query(QuizAttempt.attempted_at).filter(QuizAttempt.user_id == user_id).all():
                if timestamp:
                    active_hour_counts[timestamp.hour] += 1
            for (timestamp,) in db.query(InterviewSession.completed_at).filter(InterviewSession.user_id == user_id).all():
                if timestamp:
                    active_hour_counts[timestamp.hour] += 1
        finally:
            db.close()

    active_hours = [{"hour": hour, "activity": active_hour_counts.get(hour, 0)} for hour in range(24)]
    predicted_streak_break = current_str > 0 and not last_active_today and streak.get("hours_until_reset", 24) <= 6

    insights = []

    # Streak insights
    if current_str >= 7:
        insights.append({
            "id": "streak_strong", "type": "achievement",
            "title": "Consistency Champion!",
            "description": f"You've maintained a {current_str}-day streak. Keep it going!",
            "icon": "🔥", "priority": "medium", "actionable": False,
        })
    elif predicted_streak_break:
        insights.append({
            "id": "streak_risk", "type": "warning",
            "title": "Your streak is at risk today",
            "description": "You have an active streak but no meaningful action has been recorded today yet.",
            "icon": "⚠️", "priority": "high", "actionable": True, "action": "Take a Quiz",
        })
    elif current_str == 0:
        insights.append({
            "id": "streak_start", "type": "warning",
            "title": "Start Your Streak Today!",
            "description": "No meaningful learning activity has been recorded today yet.",
            "icon": "⚠️", "priority": "high", "actionable": True, "action": "Take a Quiz",
        })

    # Quiz insights
    if quiz_count > 0 and quiz_avg < 60:
        insights.append({
            "id": "quiz_improve", "type": "suggestion",
            "title": "Improve Your Quiz Scores",
            "description": f"Your average quiz score is {round(quiz_avg, 1)}%. Review weak topics and retake quizzes.",
            "icon": "📝", "priority": "high", "actionable": True, "action": "Retake Weak Quizzes",
        })
    elif quiz_count > 0 and quiz_avg >= 80:
        insights.append({
            "id": "quiz_strong", "type": "achievement",
            "title": "Quiz Master!",
            "description": f"Your average quiz score is {round(quiz_avg, 1)}%. You're performing excellently!",
            "icon": "🎯", "priority": "medium", "actionable": False,
        })

    # Interview insights
    if interview_count == 0:
        insights.append({
            "id": "interview_start", "type": "suggestion",
            "title": "Try a Mock Interview",
            "description": "You haven't practiced any mock interviews yet. Start one to build confidence!",
            "icon": "🎤", "priority": "high", "actionable": True, "action": "Start Interview",
        })
    elif interview_count >= 5:
        insights.append({
            "id": "interview_pro", "type": "achievement",
            "title": "Interview Practice Pro",
            "description": f"You've completed {interview_count} mock interviews. Your practice is paying off!",
            "icon": "🌟", "priority": "medium", "actionable": False,
        })

    # Resume insights
    if resume_count == 0:
        insights.append({
            "id": "resume_create", "type": "suggestion",
            "title": "Build Your Resume",
            "description": "You haven't created a resume yet. Use Resume Studio to build a professional ATS-optimized resume.",
            "icon": "📄", "priority": "high", "actionable": True, "action": "Go to Resume Studio",
        })

    # Roadmap insights
    if roadmap_count == 0:
        insights.append({
            "id": "roadmap_create", "type": "suggestion",
            "title": "Get a Learning Roadmap",
            "description": "Create a personalized learning roadmap to guide your career preparation.",
            "icon": "🗺️", "priority": "medium", "actionable": True, "action": "Generate Roadmap",
        })

    # Weak skill recommendations
    suggested_focus = [s.skill_name for s in weak_skills if s.skill_name] if weak_skills else []
    if quiz_count == 0 and "Knowledge Checks" not in suggested_focus:
        suggested_focus.append("Knowledge Checks")
    if interview_count == 0 and "Mock Interviews" not in suggested_focus:
        suggested_focus.append("Mock Interviews")
    if resume_count == 0 and "Resume Building" not in suggested_focus:
        suggested_focus.append("Resume Building")
    if roadmap_count == 0 and "Learning Roadmaps" not in suggested_focus:
        suggested_focus.append("Learning Roadmaps")

    if suggested_focus:
        insights.append({
            "id": "weak_skills", "type": "suggestion",
            "title": "Focus Areas Identified",
            "description": f"Your weakest topics are: {', '.join(suggested_focus)}. Practice these to improve.",
            "icon": "🧠", "priority": "high", "actionable": True, "action": "Practice Weak Areas",
        })

    if not insights:
        insights.append({
            "id": "steady_progress", "type": "pattern",
            "title": "Steady progress detected",
            "description": "Your recent activity is consistent across tracked learning actions.",
            "icon": "📈", "priority": "medium", "actionable": False,
        })

    result = {
        "insights": insights,
        "activeHours": active_hours,
        "consistencyScore": consistency,
        "growthRate": growth_rate,
        "predictedStreakBreak": predicted_streak_break,
        "suggestedFocusAreas": suggested_focus[:4],
    }

    redis_client.cache_json_set(cache_key, result, ttl_seconds=600)
    return result


# ══════════════════════════════════════════════════════════════
# 10. FULL DASHBOARD
# ══════════════════════════════════════════════════════════════

def get_full_dashboard(user_id: str) -> Dict:
    """Build full dashboard from REAL precomputed data."""
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
