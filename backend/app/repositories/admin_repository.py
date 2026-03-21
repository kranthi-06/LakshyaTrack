from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session, joinedload

from app.models.career import ProgressSnapshot, QuizAttempt
from app.models.user import User


def get_users_with_profiles(db: Session) -> list[User]:
    return (
        db.query(User)
        .options(joinedload(User.profile))
        .order_by(User.created_at.desc())
        .all()
    )


def get_quiz_counts_by_user(db: Session, user_ids: list) -> dict:
    if not user_ids:
        return {}
    rows = (
        db.query(QuizAttempt.user_id, sa_func.count(QuizAttempt.id))
        .filter(QuizAttempt.user_id.in_(user_ids))
        .group_by(QuizAttempt.user_id)
        .all()
    )
    return {uid: cnt for uid, cnt in rows}


def get_latest_snapshots_by_user(db: Session, user_ids: list) -> dict:
    if not user_ids:
        return {}
    latest_snap_subq = (
        db.query(
            ProgressSnapshot.user_id,
            sa_func.max(ProgressSnapshot.snapshot_date).label("max_date"),
        )
        .filter(ProgressSnapshot.user_id.in_(user_ids))
        .group_by(ProgressSnapshot.user_id)
        .subquery()
    )
    snapshots = (
        db.query(ProgressSnapshot)
        .join(
            latest_snap_subq,
            (ProgressSnapshot.user_id == latest_snap_subq.c.user_id)
            & (ProgressSnapshot.snapshot_date == latest_snap_subq.c.max_date),
        )
        .all()
    )
    return {s.user_id: s for s in snapshots}
