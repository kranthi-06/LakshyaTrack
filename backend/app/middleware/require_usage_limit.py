"""
Read-only usage-limit dependency.

Routes should still consume usage atomically inside the mutation transaction.
This dependency exists to fail fast before expensive work begins.
"""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import _resolve_user_role, get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.services.usage_service import build_limit_exceeded_detail, check_limit

logger = logging.getLogger(__name__)


def require_usage_limit(counter_name: str):
    def _dependency(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        role = _resolve_user_role(current_user)
        status_info = check_limit(db, current_user.id, counter_name, role)

        if not status_info["allowed"]:
            detail = build_limit_exceeded_detail(status_info)
            logger.info(
                "Usage limit exceeded: user=%s counter=%s current=%s limit=%s",
                current_user.email,
                detail["counter_key"],
                detail["current"],
                detail["limit"],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail,
            )

        return current_user

    return _dependency
