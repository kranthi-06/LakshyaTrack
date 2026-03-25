"""
Progress Intelligence System — Pydantic Schemas
Request/Response validation schemas for all Progress Intelligence APIs.
"""
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ── Contribution Heatmap ──────────────────────────────────────

class ContributionEntry(BaseModel):
    date: date
    count: int
    level: int  # 0-4

class ContributionResponse(BaseModel):
    contributions: List[ContributionEntry]
    total_contributions: int
    longest_streak: int
    current_streak: int
    year: int


# ── Problem Solving ──────────────────────────────────────────

class DifficultyStats(BaseModel):
    solved: int
    total: int

class ProblemSubmission(BaseModel):
    problem_id: str
    title: str
    difficulty: str  # easy, medium, hard
    status: str      # accepted, wrong_answer, time_limit, runtime_error
    language: Optional[str] = None
    topic: Optional[str] = None

class ProblemSolvingResponse(BaseModel):
    total_solved: int
    total_available: int
    acceptance_rate: float
    total_submissions: int
    difficulty: Dict[str, DifficultyStats]
    recent_submissions: List[Dict[str, Any]]


# ── Activity Tracking ────────────────────────────────────────

class TrackEventRequest(BaseModel):
    event_type: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None

class SessionStartRequest(BaseModel):
    user_agent: Optional[str] = None

class SessionEndRequest(BaseModel):
    session_id: str
    pages_visited: List[str] = Field(default_factory=list)
    features_used: List[str] = Field(default_factory=list)
    active_minutes: Optional[float] = None
    idle_minutes: Optional[float] = None

class ActivitySummaryResponse(BaseModel):
    total_sessions: int
    avg_session_duration: float
    total_active_time: float
    total_idle_time: float
    most_visited_pages: List[Dict[str, Any]]
    most_used_features: List[Dict[str, Any]]
    active_days: int


# ── Time Analytics ───────────────────────────────────────────

class DailyUsage(BaseModel):
    date: date
    total_minutes: float
    active_minutes: float

class WeeklyTrend(BaseModel):
    week: str
    week_start: date
    total_hours: float
    avg_daily_minutes: float

class TimeAnalyticsResponse(BaseModel):
    daily_usage: List[DailyUsage]
    weekly_trends: List[WeeklyTrend]
    feature_time_spent: List[Dict[str, Any]]
    total_hours_this_week: float
    total_hours_this_month: float
    avg_daily_minutes: float
    peak_hour: int
    peak_day: str


# ── Topic / Skill Map ───────────────────────────────────────

class TopicBubbleResponse(BaseModel):
    id: str
    name: str
    category: str
    problems_solved: int
    time_spent_minutes: float
    proficiency_level: str
    proficiency_score: float
    color: str
    size: float

class TopicMapResponse(BaseModel):
    topics: List[TopicBubbleResponse]
    total_topics: int
    strongest_topic: str
    weakest_topic: str


# ── Streak ───────────────────────────────────────────────────

class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: Optional[date]
    is_at_risk: bool
    hours_until_reset: float
    total_active_days: int
    weekly_activity: List[int]


# ── Badges ───────────────────────────────────────────────────

class BadgeResponse(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    category: str
    rarity: str
    is_unlocked: bool
    unlocked_at: Optional[datetime]
    progress: float
    requirement: str
    requirement_value: float
    current_value: float

class BadgeSystemResponse(BaseModel):
    badges: List[BadgeResponse]
    total_unlocked: int
    total_badges: int
    recently_unlocked: List[BadgeResponse]
    next_to_unlock: Optional[BadgeResponse]


# ── Intelligence ─────────────────────────────────────────────

class InsightResponse(BaseModel):
    id: str
    type: str  # pattern, suggestion, warning, achievement, prediction
    title: str
    description: str
    icon: str
    priority: str
    actionable: bool
    action: Optional[str] = None

class IntelligenceResponse(BaseModel):
    insights: List[InsightResponse]
    active_hours: List[Dict[str, Any]]
    consistency_score: float
    growth_rate: float
    predicted_streak_break: bool
    suggested_focus_areas: List[str]


# ── Full Dashboard ───────────────────────────────────────────

class ProgressDashboardResponse(BaseModel):
    contributions: ContributionResponse
    problem_solving: ProblemSolvingResponse
    activity: ActivitySummaryResponse
    time_analytics: TimeAnalyticsResponse
    topic_map: TopicMapResponse
    streak: StreakResponse
    badges: BadgeSystemResponse
    intelligence: IntelligenceResponse
    last_updated: datetime
