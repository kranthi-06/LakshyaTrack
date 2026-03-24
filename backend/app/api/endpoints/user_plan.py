"""User-facing SaaS helpers for plan and usage snapshots."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import _resolve_user_role, get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.services.usage_service import get_plan_snapshot, get_usage_status

router = APIRouter()


@router.get("/usage")
def get_user_usage(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    role = _resolve_user_role(current_user)
    return get_usage_status(db, current_user.id, role)


@router.get("/plan")
def get_user_plan(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    role = _resolve_user_role(current_user)
    return get_plan_snapshot(db, current_user.id, role)
