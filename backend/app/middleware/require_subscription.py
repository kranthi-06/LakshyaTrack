"""
Subscription Middleware — protects premium routes by verifying subscription status.

Usage:
    from app.middleware.require_subscription import require_subscription, require_stage

    @router.get("/premium-content")
    def premium_endpoint(
        user: User = Depends(require_subscription()),
    ):
        ...

    @router.get("/ultimate-only")
    def ultimate_endpoint(
        user: User = Depends(require_stage(3)),
    ):
        ...
"""
import logging
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, _resolve_user_role
from app.db.session import get_db
from app.models.user import User
from app.services.subscription_service import get_user_stage

logger = logging.getLogger(__name__)


def require_subscription(min_stage: int = 1):
    """
    Dependency that requires the user to have an active subscription
    at or above the specified stage.

    Admins bypass all subscription checks.

    Args:
        min_stage: Minimum subscription stage required (1=Starter, 2=Pro, 3=Ultimate)

    Returns:
        FastAPI dependency function
    """
    def _dependency(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        role = _resolve_user_role(current_user)

        # Admins always pass
        if role in ("admin", "black_admin"):
            return current_user

        stage = get_user_stage(db, current_user.id, role)

        if stage < min_stage:
            logger.warning(
                "Subscription access denied: user=%s stage=%d required=%d",
                current_user.email, stage, min_stage,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "subscription_required",
                    "message": f"This feature requires a Stage {min_stage}+ subscription.",
                    "current_stage": stage,
                    "required_stage": min_stage,
                },
            )

        return current_user

    return _dependency


def require_stage(stage: int):
    """Shorthand: require exactly this stage or higher."""
    return require_subscription(min_stage=stage)


def require_feature(feature_key: str):
    """
    Dependency that checks if the user has access to a specific feature.
    This covers both stage-based and micro-purchase based access.
    """
    def _dependency(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.subscription_service import has_feature_access

        role = _resolve_user_role(current_user)

        # Admins always pass
        if role in ("admin", "black_admin"):
            return current_user

        if not has_feature_access(db, current_user.id, feature_key, role):
            logger.warning(
                "Feature access denied: user=%s feature=%s",
                current_user.email, feature_key,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "feature_locked",
                    "message": f"You don't have access to '{feature_key}'. Please upgrade your plan.",
                    "feature_key": feature_key,
                },
            )

        return current_user

    return _dependency
