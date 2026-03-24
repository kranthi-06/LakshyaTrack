"""
Centralized LakshyaTrack SaaS plan configuration.

This module is the single source of truth for:
- plan names and stage ordering
- usage limits per plan
- counter aliases used by legacy frontend/backend code
- feature-to-counter mapping for reusable limit enforcement
"""
from __future__ import annotations

from math import inf
from typing import Dict


UNLIMITED = inf

PLAN_LIMITS: Dict[str, Dict[str, float]] = {
    "FREE": {
        "resumeStorage": 1,
        "weeklyInterviews": 1,
        "roadmap": 1,
        "resumeEditsMonthly": 1,
    },
    "STARTER": {
        "resumeStorage": 5,
        "weeklyInterviews": 10,
        "roadmap": 5,
        "resumeEditsMonthly": 10,
    },
    "PROFESSIONAL": {
        "resumeStorage": 20,
        "weeklyInterviews": 30,
        "roadmap": 15,
        "resumeEditsMonthly": 50,
    },
    "ULTIMATE": {
        "resumeStorage": UNLIMITED,
        "weeklyInterviews": UNLIMITED,
        "roadmap": UNLIMITED,
        "resumeEditsMonthly": UNLIMITED,
    },
}

PLAN_TO_STAGE = {
    "FREE": 0,
    "STARTER": 1,
    "PROFESSIONAL": 2,
    "ULTIMATE": 3,
}

STAGE_TO_PLAN = {stage: plan for plan, stage in PLAN_TO_STAGE.items()}

PLAN_TO_API_NAME = {
    "FREE": "free",
    "STARTER": "starter",
    "PROFESSIONAL": "professional",
    "ULTIMATE": "ultimate",
}

API_NAME_TO_PLAN = {api_name: plan for plan, api_name in PLAN_TO_API_NAME.items()}

CANONICAL_COUNTERS = {
    "resumeStorage": {
        "legacy": "resume_count",
        "usage_field": "resume_count",
        "reset": None,
        "display_name": "Resume Storage",
    },
    "weeklyInterviews": {
        "legacy": "interview_count_weekly",
        "usage_field": "interview_count_weekly",
        "reset": "weekly",
        "display_name": "Weekly Interviews",
    },
    "roadmap": {
        "legacy": "plan_count",
        "usage_field": "plan_count",
        "reset": None,
        "display_name": "Roadmaps",
    },
    "resumeEditsMonthly": {
        "legacy": "resume_edit_monthly",
        "usage_field": "resume_edit_monthly",
        "reset": "monthly",
        "display_name": "Monthly Resume Downloads",
    },
}

LEGACY_COUNTER_TO_CANONICAL = {
    meta["legacy"]: counter for counter, meta in CANONICAL_COUNTERS.items()
}

FEATURE_TO_COUNTER = {
    "resume_upload": "resumeStorage",
    "resume_storage": "resumeStorage",
    "resumeStorage": "resumeStorage",
    "resume_count": "resumeStorage",
    "resume_edit": "resumeEditsMonthly",
    "resume_edit_monthly": "resumeEditsMonthly",
    "resumeEditsMonthly": "resumeEditsMonthly",
    "resume_download": "resumeEditsMonthly",
    "interview_start": "weeklyInterviews",
    "weeklyInterviews": "weeklyInterviews",
    "interview_count_weekly": "weeklyInterviews",
    "roadmap_create": "roadmap",
    "roadmap": "roadmap",
    "plan_count": "roadmap",
}

# All core platform surfaces remain reachable. Limits are enforced by usage,
# not binary feature locks.
CORE_FEATURE_FLAGS = {
    "dashboard": True,
    "resume_preview": True,
    "quiz_limited": True,
    "analytics_limited": True,
    "resume_download": True,
    "resume_builder": True,
    "roadmap_generate": True,
    "interview_start": True,
    "job_portal": True,
    "ads_free": False,
}


def normalize_counter_key(counter_or_feature: str) -> str:
    """Resolve legacy counter names and feature names to canonical keys."""
    if counter_or_feature in CANONICAL_COUNTERS:
        return counter_or_feature
    if counter_or_feature in LEGACY_COUNTER_TO_CANONICAL:
        return LEGACY_COUNTER_TO_CANONICAL[counter_or_feature]
    if counter_or_feature in FEATURE_TO_COUNTER:
        return FEATURE_TO_COUNTER[counter_or_feature]
    raise KeyError(f"Unknown usage counter or feature: {counter_or_feature}")


def get_usage_field(counter_or_feature: str) -> str:
    counter_key = normalize_counter_key(counter_or_feature)
    return str(CANONICAL_COUNTERS[counter_key]["usage_field"])


def get_legacy_counter(counter_or_feature: str) -> str:
    counter_key = normalize_counter_key(counter_or_feature)
    return str(CANONICAL_COUNTERS[counter_key]["legacy"])


def get_plan_for_stage(stage: int) -> str:
    return STAGE_TO_PLAN.get(stage, "FREE")


def get_api_plan_name(plan: str) -> str:
    return PLAN_TO_API_NAME.get(plan, "free")


def serialize_limit(limit: float) -> int:
    return -1 if limit == UNLIMITED else int(limit)
