"""Plan upgrade aliases for the SaaS contract."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import _resolve_user_role, get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.services.subscription_service import get_user_stage

router = APIRouter()


class PlanUpgradeRequest(BaseModel):
    target_plan: str
    payment_method: Optional[str] = None
    coupon_code: Optional[str] = None


@router.post("/upgrade")
def upgrade_plan(
    body: PlanUpgradeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    plan_map = {
        "starter": 1,
        "professional": 2,
        "ultimate": 3,
    }

    target_stage = plan_map.get(body.target_plan.lower())
    if target_stage is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_plan",
                "message": "Invalid plan. Choose starter, professional, or ultimate.",
            },
        )

    role = _resolve_user_role(current_user)
    current_stage = get_user_stage(db, current_user.id, role)

    if current_stage >= target_stage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "already_at_or_above",
                "message": "You are already on this plan or higher.",
            },
        )

    return {
        "status": "redirect",
        "message": "Use the subscription checkout flow to complete your upgrade.",
        "checkout_url": "/plans",
        "target_plan": body.target_plan.lower(),
        "target_stage": target_stage,
        "current_stage": current_stage,
        "payment_integration": "coming_soon",
    }
