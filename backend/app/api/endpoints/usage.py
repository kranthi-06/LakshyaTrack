"""
Usage API endpoints — provides usage status and plan upgrade entry point.

Endpoints:
- GET  /usage/status          → Full usage status for the current user
- POST /usage/upgrade-plan    → Placeholder for Razorpay integration
- GET  /usage/limits          → Plan limit definitions (public)
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, _resolve_user_role
from app.db.session import get_db
from app.models.user import User
from app.services.usage_service import (
    PLAN_LIMITS,
    get_usage_status,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════

class UpgradePlanRequest(BaseModel):
    """Request body for plan upgrade (future Razorpay integration)."""
    target_plan: str  # "starter" | "professional" | "ultimate"
    payment_method: Optional[str] = None
    coupon_code: Optional[str] = None


# ══════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/status")
def get_user_usage_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    GET /usage/status — returns full usage counters, limits, and remaining
    for the current user. The frontend uses this to show/hide lock icons
    and disable buttons.
    """
    role = _resolve_user_role(current_user)
    return get_usage_status(db, current_user.id, role)


@router.get("/limits")
def get_plan_limits():
    """
    GET /usage/limits — returns the limit definitions for all plan stages.
    Public endpoint — no auth required. Used by the pricing page.
    """
    plan_names = {0: "free", 1: "starter", 2: "professional", 3: "ultimate"}
    return {
        "plans": {
            plan_names[stage]: limits
            for stage, limits in PLAN_LIMITS.items()
        }
    }


@router.post("/upgrade-plan")
def upgrade_plan(
    body: UpgradePlanRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    POST /usage/upgrade-plan — entry point for plan upgrades.

    Currently returns a redirect to the existing subscription checkout flow.
    Designed to be easily extended with Razorpay integration later.

    For now, direct users to /api/v1/subscription/checkout for actual payment.
    """
    plan_map = {
        "starter": 1,
        "professional": 2,
        "ultimate": 3,
    }

    target_stage = plan_map.get(body.target_plan)
    if target_stage is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_plan",
                "message": f"Invalid plan: {body.target_plan}. Must be one of: starter, professional, ultimate.",
            },
        )

    role = _resolve_user_role(current_user)
    from app.services.subscription_service import get_user_stage
    current_stage = get_user_stage(db, current_user.id, role)

    if current_stage >= target_stage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "already_at_or_above",
                "message": f"You are already at stage {current_stage} ({body.target_plan} is stage {target_stage}).",
            },
        )

    # Future: integrate Razorpay order creation here.
    # For now, return instructions to use the existing checkout.
    return {
        "status": "redirect",
        "message": "Use the subscription checkout flow to complete your upgrade.",
        "checkout_url": "/plans",
        "target_plan": body.target_plan,
        "target_stage": target_stage,
        "current_stage": current_stage,
        "payment_integration": "coming_soon",
    }
