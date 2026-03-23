"""
Usage Limit Middleware — strict backend enforcement of plan-based usage limits.

No feature can be bypassed from the frontend — all limits are enforced here.

Usage:
    from app.middleware.require_usage_limit import require_usage_limit

    @router.post("/upload-resume")
    def upload_resume(
        user: User = Depends(require_usage_limit("resume_count")),
    ):
        ...
"""
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, _resolve_user_role
from app.db.session import get_db
from app.models.user import User
from app.services.usage_service import check_limit

logger = logging.getLogger(__name__)


def require_usage_limit(counter_name: str):
    """
    FastAPI dependency that blocks the request if the user's usage
    limit for the given counter has been exceeded.

    Args:
        counter_name: One of:
            - "resume_count"
            - "interview_count_weekly"
            - "plan_count"
            - "resume_edit_monthly"

    Returns:
        FastAPI dependency that resolves to the current User if allowed.

    Raises:
        HTTPException 429 if limit exceeded.
    """
    def _dependency(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        role = _resolve_user_role(current_user)

        result = check_limit(
            db=db,
            user_id=current_user.id,
            counter_name=counter_name,
            user_role=role,
        )

        if not result["allowed"]:
            logger.warning(
                "LIMIT_EXCEEDED: user=%s counter=%s current=%d limit=%d",
                current_user.email,
                counter_name,
                result["current"],
                result["limit"],
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "LIMIT_EXCEEDED",
                    "message": "You have reached your plan's limit for this feature. Upgrade your plan to continue.",
                    "counter": counter_name,
                    "current": result["current"],
                    "limit": result["limit"],
                    "remaining": result["remaining"],
                    "upgrade_url": "/plans",
                },
            )

        return current_user

    return _dependency
