"""
Usage service for backend-enforced SaaS limits.

This module keeps the existing storage model and frontend response shape
compatible, while moving all limit semantics to the centralized plan config.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.plan_limits import (
    CANONICAL_COUNTERS,
    PLAN_LIMITS,
    UNLIMITED,
    get_api_plan_name,
    get_legacy_counter,
    get_plan_for_stage,
    get_usage_field,
    normalize_counter_key,
    serialize_limit,
)
from app.models.career import Roadmap
from app.models.resume import SavedResume
from app.models.usage import UserUsage
from app.services.subscription_service import get_user_stage

logger = logging.getLogger(__name__)

WEEKLY_RESET_WINDOW = timedelta(days=7)
MONTHLY_RESET_WINDOW = timedelta(days=30)
STORAGE_BASED_COUNTERS = {"resumeStorage", "roadmap"}


@dataclass
class UsageSnapshot:
    usage: UserUsage
    stage: int
    plan_key: str
    is_admin: bool


class LimitExceededError(Exception):
    """Raised when a user consumes a feature beyond the allowed plan limit."""

    def __init__(self, detail: Dict[str, Any]):
        super().__init__(detail.get("message", "Usage limit exceeded"))
        self.detail = detail


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _counter_display_name(counter_key: str) -> str:
    return str(CANONICAL_COUNTERS[counter_key]["display_name"])


def _get_reset_deadline(counter_key: str, usage: UserUsage) -> Optional[datetime]:
    if counter_key == "weeklyInterviews" and usage.last_reset_weekly:
        return _ensure_aware(usage.last_reset_weekly) + WEEKLY_RESET_WINDOW
    if counter_key == "resumeEditsMonthly" and usage.last_reset_monthly:
        return _ensure_aware(usage.last_reset_monthly) + MONTHLY_RESET_WINDOW
    return None


def _build_status(
    *,
    counter_key: str,
    current: int,
    limit: float,
    plan_key: str,
    stage: int,
    usage: UserUsage,
) -> Dict[str, Any]:
    limit_value = serialize_limit(limit)
    remaining = -1 if limit == UNLIMITED else max(0, int(limit) - current)
    reset_at = _get_reset_deadline(counter_key, usage)

    return {
        "allowed": limit == UNLIMITED or current < limit,
        "current": current,
        "limit": limit_value,
        "remaining": remaining,
        "counter": get_legacy_counter(counter_key),
        "counter_key": counter_key,
        "display_name": _counter_display_name(counter_key),
        "plan": get_api_plan_name(plan_key),
        "plan_key": plan_key,
        "stage": stage,
        "reset_at": reset_at.isoformat() if reset_at else None,
    }


def build_limit_exceeded_detail(status_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "code": "LIMIT_EXCEEDED",
        "error": "LIMIT_EXCEEDED",
        "message": "You reached your limit. Upgrade your plan.",
        "counter": status_snapshot["counter"],
        "counter_key": status_snapshot["counter_key"],
        "display_name": status_snapshot["display_name"],
        "current": status_snapshot["current"],
        "limit": status_snapshot["limit"],
        "remaining": status_snapshot["remaining"],
        "plan": status_snapshot["plan"],
        "stage": status_snapshot["stage"],
        "reset_at": status_snapshot.get("reset_at"),
        "upgrade_url": "/plans",
    }


def _build_snapshot(db: Session, user_id: uuid.UUID, user_role: str, *, lock: bool = False) -> UsageSnapshot:
    is_admin = user_role in ("admin", "black_admin")
    stage = 3 if is_admin else get_user_stage(db, user_id, user_role)
    plan_key = get_plan_for_stage(stage)
    usage = get_or_create_usage(db, user_id, lock=lock)
    auto_reset_if_needed(db, usage)
    return UsageSnapshot(
        usage=usage,
        stage=stage,
        plan_key=plan_key,
        is_admin=is_admin,
    )


def get_or_create_usage(db: Session, user_id: uuid.UUID, *, lock: bool = False) -> UserUsage:
    query = db.query(UserUsage).filter(UserUsage.user_id == user_id)
    if lock:
        query = query.with_for_update()

    usage = query.first()
    if usage is None:
        usage = UserUsage(user_id=user_id)
        db.add(usage)
        db.flush()
        logger.info("Created usage record for user %s", user_id)
    return usage


def _maybe_reset_weekly(usage: UserUsage) -> bool:
    now = _utc_now()
    last_reset = _ensure_aware(usage.last_reset_weekly)
    if last_reset is None or (now - last_reset) >= WEEKLY_RESET_WINDOW:
        usage.interview_count_weekly = 0
        usage.last_reset_weekly = now
        return True
    return False


def _maybe_reset_monthly(usage: UserUsage) -> bool:
    now = _utc_now()
    last_reset = _ensure_aware(usage.last_reset_monthly)
    if last_reset is None or (now - last_reset) >= MONTHLY_RESET_WINDOW:
        usage.resume_edit_monthly = 0
        usage.last_reset_monthly = now
        return True
    return False


def auto_reset_if_needed(db: Session, usage: UserUsage) -> None:
    weekly_reset = _maybe_reset_weekly(usage)
    monthly_reset = _maybe_reset_monthly(usage)
    if weekly_reset or monthly_reset:
        db.flush()
        logger.info(
            "Auto-reset for user %s: weekly=%s monthly=%s",
            usage.user_id,
            weekly_reset,
            monthly_reset,
        )


def sync_usage_counts(
    db: Session,
    user_id: uuid.UUID,
    *,
    counters: Optional[Iterable[str]] = None,
    usage: Optional[UserUsage] = None,
) -> UserUsage:
    """Synchronize storage-backed counters to the real DB state."""
    usage_record = usage or get_or_create_usage(db, user_id)
    counter_keys = set(counters or STORAGE_BASED_COUNTERS)

    if "resumeStorage" in counter_keys:
        usage_record.resume_count = int(
            db.query(func.count(SavedResume.id))
            .filter(SavedResume.user_id == user_id)
            .scalar()
            or 0
        )

    if "roadmap" in counter_keys:
        usage_record.plan_count = int(
            db.query(func.count(Roadmap.id))
            .filter(Roadmap.user_id == user_id)
            .scalar()
            or 0
        )

    db.flush()
    return usage_record


def check_limit(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    user_role: str = "user",
) -> Dict[str, Any]:
    """Read-only limit check used by middleware and status endpoints."""
    counter_key = normalize_counter_key(counter_name)
    snapshot = _build_snapshot(db, user_id, user_role, lock=False)

    if counter_key in STORAGE_BASED_COUNTERS:
        sync_usage_counts(db, user_id, counters=[counter_key], usage=snapshot.usage)

    field_name = get_usage_field(counter_key)
    current = int(getattr(snapshot.usage, field_name, 0) or 0)
    limit = PLAN_LIMITS[snapshot.plan_key][counter_key]

    return _build_status(
        counter_key=counter_key,
        current=current,
        limit=limit,
        plan_key=snapshot.plan_key,
        stage=snapshot.stage,
        usage=snapshot.usage,
    )


def assert_limit_available(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    user_role: str = "user",
) -> Dict[str, Any]:
    status_snapshot = check_limit(db, user_id, counter_name, user_role)
    if not status_snapshot["allowed"]:
        raise LimitExceededError(build_limit_exceeded_detail(status_snapshot))
    return status_snapshot


def consume_usage(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    *,
    user_role: str = "user",
    amount: int = 1,
    sync_before_consume: bool = False,
) -> Dict[str, Any]:
    """
    Atomically consume usage inside the current transaction.

    The caller is responsible for committing or rolling back the transaction.
    """
    if amount < 0:
        raise ValueError("Usage amount must be >= 0")

    counter_key = normalize_counter_key(counter_name)
    snapshot = _build_snapshot(db, user_id, user_role, lock=True)

    if sync_before_consume or counter_key in STORAGE_BASED_COUNTERS:
        sync_usage_counts(db, user_id, counters=[counter_key], usage=snapshot.usage)

    field_name = get_usage_field(counter_key)
    current = int(getattr(snapshot.usage, field_name, 0) or 0)
    limit = PLAN_LIMITS[snapshot.plan_key][counter_key]

    preflight = _build_status(
        counter_key=counter_key,
        current=current,
        limit=limit,
        plan_key=snapshot.plan_key,
        stage=snapshot.stage,
        usage=snapshot.usage,
    )
    if not preflight["allowed"]:
        raise LimitExceededError(build_limit_exceeded_detail(preflight))

    setattr(snapshot.usage, field_name, current + amount)
    db.flush()

    return _build_status(
        counter_key=counter_key,
        current=current + amount,
        limit=limit,
        plan_key=snapshot.plan_key,
        stage=snapshot.stage,
        usage=snapshot.usage,
    )


def release_usage(
    db: Session,
    user_id: uuid.UUID,
    counter_name: str,
    *,
    amount: int = 1,
    sync_before_release: bool = False,
) -> int:
    """Release usage inside the current transaction after a delete/rollback-style action."""
    if amount < 0:
        raise ValueError("Usage amount must be >= 0")

    counter_key = normalize_counter_key(counter_name)
    usage = get_or_create_usage(db, user_id, lock=True)
    auto_reset_if_needed(db, usage)

    if sync_before_release or counter_key in STORAGE_BASED_COUNTERS:
        sync_usage_counts(db, user_id, counters=[counter_key], usage=usage)

    field_name = get_usage_field(counter_key)
    current = int(getattr(usage, field_name, 0) or 0)
    new_value = max(0, current - amount)
    setattr(usage, field_name, new_value)
    db.flush()
    return new_value


def get_usage_status(
    db: Session,
    user_id: uuid.UUID,
    user_role: str = "user",
) -> Dict[str, Any]:
    snapshot = _build_snapshot(db, user_id, user_role, lock=False)
    sync_usage_counts(db, user_id, counters=STORAGE_BASED_COUNTERS, usage=snapshot.usage)

    usage = snapshot.usage
    counters: Dict[str, Dict[str, Any]] = {}
    limits: Dict[str, int] = {}

    for counter_key in CANONICAL_COUNTERS:
        field_name = get_usage_field(counter_key)
        current = int(getattr(usage, field_name, 0) or 0)
        limit = PLAN_LIMITS[snapshot.plan_key][counter_key]
        legacy_counter = get_legacy_counter(counter_key)
        status_snapshot = _build_status(
            counter_key=counter_key,
            current=current,
            limit=limit,
            plan_key=snapshot.plan_key,
            stage=snapshot.stage,
            usage=usage,
        )
        counters[legacy_counter] = {
            "current": status_snapshot["current"],
            "limit": status_snapshot["limit"],
            "remaining": status_snapshot["remaining"],
            "exceeded": not status_snapshot["allowed"],
            "counter_key": counter_key,
            "display_name": status_snapshot["display_name"],
        }
        limits[counter_key] = status_snapshot["limit"]

    return {
        "stage": snapshot.stage,
        "plan": get_api_plan_name(snapshot.plan_key),
        "plan_key": snapshot.plan_key,
        "is_admin": snapshot.is_admin,
        "usage": {
            "resumeStorageUsed": int(usage.resume_count or 0),
            "interviewsUsedWeekly": int(usage.interview_count_weekly or 0),
            "roadmapUsed": int(usage.plan_count or 0),
            "resumeEditsUsedMonthly": int(usage.resume_edit_monthly or 0),
            "resumeDownloadsUsedMonthly": int(usage.resume_edit_monthly or 0),
            "lastWeeklyReset": _ensure_aware(usage.last_reset_weekly).isoformat() if usage.last_reset_weekly else None,
            "lastMonthlyReset": _ensure_aware(usage.last_reset_monthly).isoformat() if usage.last_reset_monthly else None,
        },
        "limits": limits,
        "counters": counters,
        "resets": {
            "weekly_resets_at": _get_reset_deadline("weeklyInterviews", usage).isoformat()
            if _get_reset_deadline("weeklyInterviews", usage)
            else None,
            "monthly_resets_at": _get_reset_deadline("resumeEditsMonthly", usage).isoformat()
            if _get_reset_deadline("resumeEditsMonthly", usage)
            else None,
        },
    }


def get_plan_snapshot(
    db: Session,
    user_id: uuid.UUID,
    user_role: str = "user",
) -> Dict[str, Any]:
    snapshot = _build_snapshot(db, user_id, user_role, lock=False)
    return {
        "stage": snapshot.stage,
        "plan": get_api_plan_name(snapshot.plan_key),
        "plan_key": snapshot.plan_key,
        "limits": {
            counter_key: serialize_limit(limit)
            for counter_key, limit in PLAN_LIMITS[snapshot.plan_key].items()
        },
        "legacy_limits": {
            get_legacy_counter(counter_key): serialize_limit(limit)
            for counter_key, limit in PLAN_LIMITS[snapshot.plan_key].items()
        },
    }


def get_public_plan_limits() -> Dict[str, Dict[str, Dict[str, int]]]:
    return {
        "plans": {
            get_api_plan_name(plan_key): {
                get_legacy_counter(counter_key): serialize_limit(limit)
                for counter_key, limit in limits.items()
            }
            for plan_key, limits in PLAN_LIMITS.items()
        },
        "canonical_plans": {
            get_api_plan_name(plan_key): {
                counter_key: serialize_limit(limit)
                for counter_key, limit in limits.items()
            }
            for plan_key, limits in PLAN_LIMITS.items()
        },
    }


def bulk_reset_weekly(db: Session) -> int:
    threshold = _utc_now() - WEEKLY_RESET_WINDOW
    users = (
        db.query(UserUsage)
        .filter(UserUsage.last_reset_weekly <= threshold)
        .all()
    )
    count = 0
    now = _utc_now()
    for usage in users:
        usage.interview_count_weekly = 0
        usage.last_reset_weekly = now
        count += 1
    if count:
        db.commit()
        logger.info("Bulk weekly reset: %d users", count)
    return count


def bulk_reset_monthly(db: Session) -> int:
    threshold = _utc_now() - MONTHLY_RESET_WINDOW
    users = (
        db.query(UserUsage)
        .filter(UserUsage.last_reset_monthly <= threshold)
        .all()
    )
    count = 0
    now = _utc_now()
    for usage in users:
        usage.resume_edit_monthly = 0
        usage.last_reset_monthly = now
        count += 1
    if count:
        db.commit()
        logger.info("Bulk monthly reset: %d users", count)
    return count
