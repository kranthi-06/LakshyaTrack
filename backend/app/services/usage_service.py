"""
Usage Service — centralized business logic for:
- Usage limit definitions per plan stage
- Usage counter get/increment/reset
- Auto-reset logic (weekly & monthly)
- Limit checking before allowing actions

All limits are enforced STRICTLY in the backend — frontend is for UX only.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.usage import UserUsage
from app.services.subscription_service import get_user_stage

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# PLAN LIMITS — Single source of truth for all usage caps
# stage 0 = Free, 1 = Starter, 2 = Professional, 3 = Ultimate
# -1 means unlimited
# ══════════════════════════════════════════════════════════════

PLAN_LIMITS: Dict[int, Dict[str, int]] = {
    0: {  # FREE
        "resume_count": 1,
        "interview_count_weekly": 2,
        "plan_count": 1,
        "resume_edit_monthly": 3,
    },
    1: {  # STARTER (BASIC)
        "resume_count": 3,
        "interview_count_weekly": 5,
        "plan_count": 3,
        "resume_edit_monthly": 10,
    },
    2: {  # PROFESSIONAL (PRO)
        "resume_count": 10,
        "interview_count_weekly": 15,
        "plan_count": 10,
        "resume_edit_monthly": 30,
    },
    3: {  # ULTIMATE — unlimited everything
        "resume_count": -1,
        "interview_count_weekly": -1,
        "plan_count": -1,
        "resume_edit_monthly": -1,
    },
}


# ══════════════════════════════════════════════════════════════
# USAGE RECORD — get or create (lazy initialization)
# ══════════════════════════════════════════════════════════════

def get_or_create_usage(db: Session, user_id: uuid.UUID) -> UserUsage:
    """
    Get or lazily create a UserUsage record for the given user.
    This ensures every user has a usage record without requiring
    explicit creation during signup.
    """
    usage = (
        db.query(UserUsage)
        .filter(UserUsage.user_id == user_id)
        .first()
    )
    if usage is None:
        usage = UserUsage(user_id=user_id)
        db.add(usage)
        db.commit()
        db.refresh(usage)
        logger.info("Created usage record for user %s", user_id)
    return usage


# ══════════════════════════════════════════════════════════════
# AUTO-RESET — weekly & monthly counter resets
# ══════════════════════════════════════════════════════════════

def _maybe_reset_weekly(usage: UserUsage) -> bool:
    """Reset weekly counters if 7+ days have passed since last reset."""
    now = datetime.now(timezone.utc)
    if usage.last_reset_weekly is None or (now - usage.last_reset_weekly) >= timedelta(days=7):
        usage.interview_count_weekly = 0
        usage.last_reset_weekly = now
        return True
    return False


def _maybe_reset_monthly(usage: UserUsage) -> bool:
    """Reset monthly counters if 30+ days have passed since last reset."""
    now = datetime.now(timezone.utc)
    if usage.last_reset_monthly is None or (now - usage.last_reset_monthly) >= timedelta(days=30):
        usage.resume_edit_monthly = 0
        usage.last_reset_monthly = now
        return True
    return False


def auto_reset_if_needed(db: Session, usage: UserUsage) -> None:
    """
    Check and perform any needed time-based counter resets.
    Called before every limit check to ensure counters are fresh.
    """
    weekly_reset = _maybe_reset_weekly(usage)
    monthly_reset = _maybe_reset_monthly(usage)
    if weekly_reset or monthly_reset:
        db.commit()
        logger.info(
            "Auto-reset for user %s: weekly=%s, monthly=%s",
            usage.user_id, weekly_reset, monthly_reset,
        )


# ══════════════════════════════════════════════════════════════
# LIMIT CHECKING
# ══════════════════════════════════════════════════════════════

def get_limit_for_stage(stage: int, counter_name: str) -> int:
    """Get the limit for a specific counter at a given plan stage."""
    stage_limits = PLAN_LIMITS.get(stage, PLAN_LIMITS[0])
    return stage_limits.get(counter_name, 0)


def check_limit(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    user_role: str = "user",
) -> Dict[str, Any]:
    """
    Check if a user has exceeded the limit for a given counter.

    Returns:
        {
            "allowed": bool,
            "current": int,
            "limit": int,       # -1 = unlimited
            "remaining": int,   # -1 = unlimited
            "counter": str,
        }
    """
    # Admins always bypass limits
    if user_role in ("admin", "black_admin"):
        return {
            "allowed": True,
            "current": 0,
            "limit": -1,
            "remaining": -1,
            "counter": counter_name,
        }

    stage = get_user_stage(db, user_id, user_role)
    limit = get_limit_for_stage(stage, counter_name)

    usage = get_or_create_usage(db, user_id)
    auto_reset_if_needed(db, usage)

    current = getattr(usage, counter_name, 0)

    # -1 = unlimited
    if limit == -1:
        return {
            "allowed": True,
            "current": current,
            "limit": -1,
            "remaining": -1,
            "counter": counter_name,
        }

    allowed = current < limit
    remaining = max(0, limit - current)

    return {
        "allowed": allowed,
        "current": current,
        "limit": limit,
        "remaining": remaining,
        "counter": counter_name,
    }


def increment_usage(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    amount: int = 1,
) -> int:
    """
    Increment a usage counter by the given amount.
    Returns the new counter value.
    """
    usage = get_or_create_usage(db, user_id)
    auto_reset_if_needed(db, usage)

    current = getattr(usage, counter_name, 0)
    new_value = current + amount
    setattr(usage, counter_name, new_value)
    db.commit()

    logger.info(
        "Usage incremented: user=%s counter=%s %d->%d",
        user_id, counter_name, current, new_value,
    )
    return new_value


def decrement_usage(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    amount: int = 1,
) -> int:
    """
    Decrement a usage counter (e.g., when a resume is deleted).
    Never goes below 0. Returns the new counter value.
    """
    usage = get_or_create_usage(db, user_id)
    current = getattr(usage, counter_name, 0)
    new_value = max(0, current - amount)
    setattr(usage, counter_name, new_value)
    db.commit()
    return new_value


# ══════════════════════════════════════════════════════════════
# FULL USAGE STATUS — for the frontend
# ══════════════════════════════════════════════════════════════

def get_usage_status(
    db: Session,
    user_id: uuid.UUID,
    user_role: str = "user",
) -> Dict[str, Any]:
    """
    Build a complete usage status response for the frontend.
    Includes current counts, limits, and remaining for every counter.
    """
    is_admin = user_role in ("admin", "black_admin")
    stage = get_user_stage(db, user_id, user_role)
    usage = get_or_create_usage(db, user_id)
    auto_reset_if_needed(db, usage)

    stage_limits = PLAN_LIMITS.get(stage, PLAN_LIMITS[0])
    counters = {}

    for counter_name, limit in stage_limits.items():
        current = getattr(usage, counter_name, 0)
        if is_admin or limit == -1:
            counters[counter_name] = {
                "current": current,
                "limit": -1,
                "remaining": -1,
                "exceeded": False,
            }
        else:
            remaining = max(0, limit - current)
            counters[counter_name] = {
                "current": current,
                "limit": limit,
                "remaining": remaining,
                "exceeded": current >= limit,
            }

    return {
        "stage": stage,
        "plan": _stage_to_plan_label(stage),
        "is_admin": is_admin,
        "counters": counters,
        "resets": {
            "weekly_resets_at": (
                (usage.last_reset_weekly + timedelta(days=7)).isoformat()
                if usage.last_reset_weekly else None
            ),
            "monthly_resets_at": (
                (usage.last_reset_monthly + timedelta(days=30)).isoformat()
                if usage.last_reset_monthly else None
            ),
        },
    }


def _stage_to_plan_label(stage: int) -> str:
    return {0: "free", 1: "starter", 2: "professional", 3: "ultimate"}.get(stage, "free")


# ══════════════════════════════════════════════════════════════
# BULK RESET — background job
# ══════════════════════════════════════════════════════════════

def bulk_reset_weekly(db: Session) -> int:
    """
    Background job: reset weekly counters for all users whose
    7-day window has elapsed. Returns count of users reset.
    """
    threshold = datetime.now(timezone.utc) - timedelta(days=7)
    users = (
        db.query(UserUsage)
        .filter(UserUsage.last_reset_weekly <= threshold)
        .all()
    )
    count = 0
    for u in users:
        u.interview_count_weekly = 0
        u.last_reset_weekly = datetime.now(timezone.utc)
        count += 1
    if count:
        db.commit()
        logger.info("Bulk weekly reset: %d users", count)
    return count


def bulk_reset_monthly(db: Session) -> int:
    """
    Background job: reset monthly counters for all users whose
    30-day window has elapsed. Returns count of users reset.
    """
    threshold = datetime.now(timezone.utc) - timedelta(days=30)
    users = (
        db.query(UserUsage)
        .filter(UserUsage.last_reset_monthly <= threshold)
        .all()
    )
    count = 0
    for u in users:
        u.resume_edit_monthly = 0
        u.last_reset_monthly = datetime.now(timezone.utc)
        count += 1
    if count:
        db.commit()
        logger.info("Bulk monthly reset: %d users", count)
    return count
