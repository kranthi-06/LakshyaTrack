"""
Progress Intelligence System — API Router
All endpoints for the Progress Intelligence Dashboard.
Completely isolated — no modification to existing routers.
"""
import logging
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.api.deps import get_current_user, get_db
from app.models.user import User

from .models import (
    DailyContribution, ProblemStat, ActivityLog,
    UserSession, TopicStat, UserBadge, UserStreak,
)
from .schemas import (
    ContributionResponse, ContributionEntry,
    ProblemSubmission, ProblemSolvingResponse,
    TrackEventRequest, SessionStartRequest, SessionEndRequest,
    ActivitySummaryResponse,
    TimeAnalyticsResponse,
    TopicMapResponse, TopicBubbleResponse,
    StreakResponse,
    BadgeSystemResponse, BadgeResponse,
    IntelligenceResponse, InsightResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress-intelligence", tags=["Progress Intelligence"])


# ── Helper ────────────────────────────────────────────────────

def _get_contribution_level(count: int) -> int:
    if count == 0: return 0
    if count <= 2: return 1
    if count <= 5: return 2
    if count <= 8: return 3
    return 4


# ══════════════════════════════════════════════════════════════
# 1. CONTRIBUTION HEATMAP ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/contributions", response_model=ContributionResponse)
async def get_contributions(
    year: int = Query(default=None, description="Year to get contributions for"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get contribution heatmap data for a specific year."""
    if year is None:
        year = datetime.now(timezone.utc).year

    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    contributions = db.query(DailyContribution).filter(
        DailyContribution.user_id == str(current_user.id),
        DailyContribution.date >= start_date,
        DailyContribution.date <= end_date,
    ).order_by(DailyContribution.date).all()

    contrib_map = {c.date: c.count for c in contributions}
    total = sum(c.count for c in contributions)

    # Build full year grid
    entries = []
    current = start_date
    today = datetime.now(timezone.utc).date()
    while current <= min(end_date, today):
        count = contrib_map.get(current, 0)
        entries.append(ContributionEntry(
            date=current,
            count=count,
            level=_get_contribution_level(count),
        ))
        current += timedelta(days=1)

    # Calculate streaks
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    for entry in entries:
        if entry.count > 0:
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0

    # Current streak (from today backwards)
    for entry in reversed(entries):
        if entry.count > 0:
            current_streak += 1
        else:
            break

    return ContributionResponse(
        contributions=entries,
        total_contributions=total,
        longest_streak=longest_streak,
        current_streak=current_streak,
        year=year,
    )


@router.post("/contributions/record")
async def record_contribution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a contribution for today. Called on significant user actions."""
    today = datetime.now(timezone.utc).date()
    user_id = str(current_user.id)

    existing = db.query(DailyContribution).filter(
        DailyContribution.user_id == user_id,
        DailyContribution.date == today,
    ).first()

    if existing:
        existing.count += 1
        existing.updated_at = datetime.now(timezone.utc)
    else:
        existing = DailyContribution(
            user_id=user_id,
            date=today,
            count=1,
        )
        db.add(existing)

    db.commit()
    return {"status": "recorded", "date": str(today), "count": existing.count}


# ══════════════════════════════════════════════════════════════
# 2. PROBLEM SOLVING ANALYTICS
# ══════════════════════════════════════════════════════════════

@router.get("/problems/stats", response_model=ProblemSolvingResponse)
async def get_problem_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get problem solving analytics."""
    user_id = str(current_user.id)

    # Total submissions
    total = db.query(func.count(ProblemStat.id)).filter(
        ProblemStat.user_id == user_id
    ).scalar() or 0

    # Accepted submissions
    accepted = db.query(func.count(ProblemStat.id)).filter(
        ProblemStat.user_id == user_id,
        ProblemStat.status == "accepted",
    ).scalar() or 0

    # By difficulty
    difficulty = {}
    for diff in ["easy", "medium", "hard"]:
        solved = db.query(func.count(ProblemStat.id)).filter(
            ProblemStat.user_id == user_id,
            ProblemStat.difficulty == diff,
            ProblemStat.status == "accepted",
        ).scalar() or 0
        total_diff = {"easy": 750, "medium": 1500, "hard": 600}
        difficulty[diff] = {"solved": solved, "total": total_diff[diff]}

    # Recent submissions
    recent = db.query(ProblemStat).filter(
        ProblemStat.user_id == user_id
    ).order_by(ProblemStat.submitted_at.desc()).limit(15).all()

    recent_list = [{
        "id": str(r.id),
        "title": r.title,
        "difficulty": r.difficulty,
        "status": r.status,
        "language": r.language,
        "timestamp": r.submitted_at.isoformat() if r.submitted_at else None,
    } for r in recent]

    return ProblemSolvingResponse(
        total_solved=accepted,
        total_available=2850,
        acceptance_rate=round((accepted / max(total, 1)) * 100, 1),
        total_submissions=total,
        difficulty=difficulty,
        recent_submissions=recent_list,
    )


@router.post("/problems/submit")
async def submit_problem(
    submission: ProblemSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a problem submission."""
    stat = ProblemStat(
        user_id=str(current_user.id),
        problem_id=submission.problem_id,
        title=submission.title,
        difficulty=submission.difficulty,
        status=submission.status,
        language=submission.language,
        topic=submission.topic,
    )
    db.add(stat)
    db.commit()
    return {"status": "recorded", "id": str(stat.id)}


# ══════════════════════════════════════════════════════════════
# 3. ACTIVITY TRACKING
# ══════════════════════════════════════════════════════════════

@router.post("/activity/track")
async def track_activity(
    event: TrackEventRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record an activity event."""
    log = ActivityLog(
        user_id=str(current_user.id),
        event_type=event.event_type,
        metadata=event.metadata,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        session_id=event.session_id,
    )
    db.add(log)
    db.commit()
    return {"status": "tracked", "id": str(log.id)}


@router.post("/sessions/start")
async def start_session(
    req: SessionStartRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a new user session."""
    session = UserSession(
        user_id=str(current_user.id),
        session_token=str(uuid4()),
        ip_address=request.client.host if request.client else None,
        user_agent=req.user_agent or request.headers.get("user-agent"),
    )
    db.add(session)
    db.commit()
    return {"session_id": str(session.id), "token": session.session_token}


@router.post("/sessions/end")
async def end_session(
    req: SessionEndRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """End a user session."""
    session = db.query(UserSession).filter(
        UserSession.id == req.session_id,
        UserSession.user_id == str(current_user.id),
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    session.logout_time = now
    session.is_active = False
    session.pages_visited = req.pages_visited
    session.features_used = req.features_used
    session.active_minutes = req.active_minutes
    session.idle_minutes = req.idle_minutes

    if session.login_time:
        session.duration_minutes = (now - session.login_time).total_seconds() / 60

    db.commit()
    return {"status": "ended", "duration_minutes": session.duration_minutes}


@router.get("/activity/summary", response_model=ActivitySummaryResponse)
async def get_activity_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get activity summary statistics."""
    user_id = str(current_user.id)

    # Session stats
    sessions = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_active == False,
    ).all()

    total_sessions = len(sessions)
    avg_duration = 0
    total_active = 0
    total_idle = 0

    if sessions:
        durations = [s.duration_minutes for s in sessions if s.duration_minutes]
        avg_duration = sum(durations) / len(durations) if durations else 0
        total_active = sum(s.active_minutes or 0 for s in sessions)
        total_idle = sum(s.idle_minutes or 0 for s in sessions)

    # Active days
    active_days = db.query(func.count(func.distinct(
        func.date(ActivityLog.timestamp)
    ))).filter(ActivityLog.user_id == user_id).scalar() or 0

    return ActivitySummaryResponse(
        total_sessions=total_sessions,
        avg_session_duration=round(avg_duration, 1),
        total_active_time=round(total_active, 1),
        total_idle_time=round(total_idle, 1),
        most_visited_pages=[],
        most_used_features=[],
        active_days=active_days,
    )


# ══════════════════════════════════════════════════════════════
# 4. STREAK ENGINE
# ══════════════════════════════════════════════════════════════

@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get streak data for the current user."""
    user_id = str(current_user.id)

    streak = db.query(UserStreak).filter(
        UserStreak.user_id == user_id
    ).first()

    if not streak:
        streak = UserStreak(user_id=user_id)
        db.add(streak)
        db.commit()

    now = datetime.now(timezone.utc)
    hours_left = max(0, 24 - now.hour - (1 if now.minute > 0 else 0))

    return StreakResponse(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_active_date=streak.last_active_date,
        is_at_risk=hours_left < 6 and streak.current_streak > 0,
        hours_until_reset=hours_left,
        total_active_days=streak.total_active_days,
        weekly_activity=streak.streak_history[-7:] if streak.streak_history else [0] * 7,
    )


@router.post("/streak/touch")
async def touch_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Touch streak — called daily on first activity."""
    user_id = str(current_user.id)
    today = datetime.now(timezone.utc).date()

    streak = db.query(UserStreak).filter(
        UserStreak.user_id == user_id
    ).first()

    if not streak:
        streak = UserStreak(user_id=user_id)
        db.add(streak)

    if streak.last_active_date == today:
        return {"status": "already_touched", "current_streak": streak.current_streak}

    yesterday = today - timedelta(days=1)
    if streak.last_active_date == yesterday:
        streak.current_streak += 1
    elif streak.last_active_date and streak.last_active_date < yesterday:
        streak.current_streak = 1
    else:
        streak.current_streak = 1

    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    streak.last_active_date = today
    streak.total_active_days = (streak.total_active_days or 0) + 1
    streak.updated_at = datetime.now(timezone.utc)

    db.commit()
    return {
        "status": "touched",
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
    }


# ══════════════════════════════════════════════════════════════
# 5. BADGE SYSTEM
# ══════════════════════════════════════════════════════════════

@router.get("/badges")
async def get_badges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all badges and their unlock status."""
    user_id = str(current_user.id)

    badges = db.query(UserBadge).filter(
        UserBadge.user_id == user_id
    ).all()

    unlocked = [b for b in badges if b.is_unlocked]
    locked = sorted([b for b in badges if not b.is_unlocked], key=lambda b: b.progress, reverse=True)

    return {
        "badges": [{
            "id": b.badge_id,
            "name": b.badge_name,
            "category": b.category,
            "rarity": b.rarity,
            "is_unlocked": b.is_unlocked,
            "unlocked_at": b.unlocked_at.isoformat() if b.unlocked_at else None,
            "progress": b.progress,
            "current_value": b.current_value,
            "requirement_value": b.requirement_value,
        } for b in badges],
        "total_unlocked": len(unlocked),
        "total_badges": len(badges),
        "next_to_unlock": locked[0].badge_id if locked else None,
    }


# ══════════════════════════════════════════════════════════════
# 6. TOPIC / SKILL MAP
# ══════════════════════════════════════════════════════════════

@router.get("/topics")
async def get_topic_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get topic/skill statistics for the bubble map."""
    user_id = str(current_user.id)

    topics = db.query(TopicStat).filter(
        TopicStat.user_id == user_id
    ).all()

    if not topics:
        return {"topics": [], "total_topics": 0, "strongest_topic": "", "weakest_topic": ""}

    sorted_topics = sorted(topics, key=lambda t: t.proficiency_score, reverse=True)

    return {
        "topics": [{
            "id": str(t.id),
            "name": t.topic_name,
            "category": t.category,
            "problems_solved": t.problems_solved,
            "time_spent_minutes": t.time_spent_minutes,
            "proficiency_score": t.proficiency_score,
        } for t in topics],
        "total_topics": len(topics),
        "strongest_topic": sorted_topics[0].topic_name,
        "weakest_topic": sorted_topics[-1].topic_name,
    }


# ══════════════════════════════════════════════════════════════
# 7. FULL DASHBOARD ENDPOINT (Aggregated)
# ══════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_full_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the complete Progress Intelligence Dashboard data.
    Aggregates all sub-endpoints for a single API call.
    """
    # In production, this would call all the sub-services
    # For now, return a status indicating the dashboard is active
    return {
        "status": "active",
        "user_id": str(current_user.id),
        "message": "Progress Intelligence Dashboard is operational",
        "endpoints": {
            "contributions": "/api/v1/progress-intelligence/contributions",
            "problems": "/api/v1/progress-intelligence/problems/stats",
            "activity": "/api/v1/progress-intelligence/activity/summary",
            "streak": "/api/v1/progress-intelligence/streak",
            "badges": "/api/v1/progress-intelligence/badges",
            "topics": "/api/v1/progress-intelligence/topics",
        },
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
