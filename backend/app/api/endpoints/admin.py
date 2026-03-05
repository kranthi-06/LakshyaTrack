"""
Admin API Endpoints — VidyaMithra Multi-Level Admin System

Routes:
  require_admin:
    GET  /admin/users           — List all users
    GET  /admin/progress        — View all progress
    GET  /admin/inactivity      — Inactivity dashboard

  require_black_admin:
    POST /admin/blacklist-user    — Blacklist a user
    POST /admin/unblacklist-user  — Unblacklist a user
    POST /admin/promote-user      — Promote user → admin
    POST /admin/demote-user       — Demote admin → user
    POST /admin/delete-user       — Delete a user
    GET  /admin/command-centre    — Admin command centre data
    GET  /admin/blacklist         — View blacklist records
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.api import deps
from app.models.user import User, Profile, Blacklist
from app.schemas.user import (
    AdminUserView, BlacklistRequest, UnblacklistRequest,
    PromoteRequest, DemoteRequest, DeleteUserRequest, BlacklistRecord
)
from app.core.config import settings
import uuid

router = APIRouter()


# ══════════════════════════════════════════════════════════════
# READ-ONLY ADMIN ENDPOINTS (require_admin)
# ══════════════════════════════════════════════════════════════

@router.get("/users")
def list_all_users(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
) -> Any:
    """List all users with profile details. Accessible by admin + black_admin."""
    from sqlalchemy.orm import joinedload
    from app.models.career import Roadmap, ProgressSnapshot

    query = db.query(User).options(joinedload(User.profile))

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_pattern))
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    if not users:
        return {"users": [], "total": total}

    user_ids = [u.id for u in users]

    # Bulk-fetch active roadmaps for all users in one query
    roadmaps = db.query(Roadmap).filter(
        Roadmap.user_id.in_(user_ids),
        Roadmap.is_active == True
    ).all()
    roadmap_map = {r.user_id: r for r in roadmaps}

    # Bulk-fetch latest progress snapshots using a subquery for max date
    from sqlalchemy import func as sa_func
    latest_snap_subq = (
        db.query(
            ProgressSnapshot.user_id,
            sa_func.max(ProgressSnapshot.snapshot_date).label("max_date")
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
            & (ProgressSnapshot.snapshot_date == latest_snap_subq.c.max_date)
        )
        .all()
    )
    snap_map = {s.user_id: s for s in snapshots}

    result = []
    for u in users:
        # Compute progress status from pre-fetched roadmap
        roadmap = roadmap_map.get(u.id)
        progress_status = "No Roadmap"
        if roadmap and roadmap.roadmap_data and "levels" in roadmap.roadmap_data:
            levels = roadmap.roadmap_data["levels"]
            current_stage = 1
            for idx, lvl in enumerate(levels):
                is_completed = all(s.get("status") == "completed" for s in lvl.get("skills", []))
                if not is_completed:
                    current_stage = idx + 1
                    break
            else:
                current_stage = len(levels)
            progress_status = f"Stage {current_stage}: {roadmap.target_role}"

        snap = snap_map.get(u.id)

        result.append({
            "id": str(u.id),
            "email": u.email,
            "role": u.role or "user",
            "is_active": u.is_active,
            "is_blacklisted": u.is_blacklisted,
            "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "full_name": u.profile.full_name if u.profile else u.email.split("@")[0],
            "progress_status": progress_status,
            "career_score": snap.career_readiness_score if snap else 0.0,
            "quizzes_passed": snap.total_quizzes_passed if snap else 0,
            "interviews_done": snap.total_interviews_done if snap else 0,
        })

    return {"users": result, "total": total}


@router.get("/progress")
def view_all_progress(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> Any:
    """View all user progress. Accessible by admin + black_admin."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    
    result = []
    for u in users:
        # Gather quiz attempts count
        from app.models.career import QuizAttempt, ProgressSnapshot
        quiz_count = db.query(QuizAttempt).filter(QuizAttempt.user_id == u.id).count()
        
        # Gather progress snapshot
        progress = db.query(ProgressSnapshot).filter(
            ProgressSnapshot.user_id == u.id
        ).order_by(ProgressSnapshot.snapshot_date.desc()).first()
        
        result.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.profile.full_name if u.profile else u.email.split("@")[0],
            "role": u.role or "user",
            "quiz_attempts": quiz_count,
            "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
            "progress_data": {
                "overall_score": progress.overall_score if progress else 0,
                "skills_count": len(progress.skill_scores) if progress and progress.skill_scores else 0,
            } if progress else None,
        })
    
    return {"progress": result}


@router.get("/inactivity")
def inactivity_dashboard(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
    days: int = Query(default=7, ge=1, le=365),
) -> Any:
    """
    Inactivity Dashboard - show users inactive for N days.
    Accessible by admin + black_admin.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Users who either never had activity OR were last active before cutoff
    inactive_users = db.query(User).filter(
        (User.last_active_at == None) | (User.last_active_at < cutoff)
    ).order_by(User.last_active_at.asc().nullsfirst()).all()
    
    result = []
    for u in inactive_users:
        result.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.profile.full_name if u.profile else u.email.split("@")[0],
            "role": u.role or "user",
            "is_blacklisted": u.is_blacklisted,
            "last_active_at": u.last_active_at.isoformat() if u.last_active_at else "Never",
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    
    return {
        "inactive_users": result,
        "total": len(result),
        "filter_days": days,
    }


@router.get("/stats")
def admin_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
) -> Any:
    """Quick statistics for admin dashboard."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(
        User.last_active_at >= datetime.now(timezone.utc) - timedelta(days=7)
    ).count()
    blacklisted_users = db.query(User).filter(User.is_blacklisted == True).count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    
    return {
        "total_users": total_users,
        "active_users_7d": active_users,
        "blacklisted_users": blacklisted_users,
        "admin_count": admin_count,
    }


# ══════════════════════════════════════════════════════════════
# BLACK-ADMIN ONLY ENDPOINTS (require_black_admin)
# ══════════════════════════════════════════════════════════════

@router.get("/command-centre")
def command_centre(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """
    Admin Command Centre — Full system overview.
    Only accessible by black_admin.
    """
    total_users = db.query(User).count()
    active_7d = db.query(User).filter(
        User.last_active_at >= datetime.now(timezone.utc) - timedelta(days=7)
    ).count()
    active_30d = db.query(User).filter(
        User.last_active_at >= datetime.now(timezone.utc) - timedelta(days=30)
    ).count()
    blacklisted = db.query(User).filter(User.is_blacklisted == True).count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    
    # Recent registrations
    recent_users = db.query(User).order_by(
        User.created_at.desc()
    ).limit(10).all()
    
    recent_list = []
    for u in recent_users:
        recent_list.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.profile.full_name if u.profile else u.email.split("@")[0],
            "role": u.role or "user",
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    
    # Blacklist records
    blacklist_records = db.query(Blacklist).order_by(
        Blacklist.blacklisted_at.desc()
    ).limit(20).all()
    
    bl_list = []
    for bl in blacklist_records:
        bl_list.append({
            "user_id": str(bl.user_id),
            "email": bl.email,
            "reason": bl.reason,
            "blacklisted_at": bl.blacklisted_at.isoformat() if bl.blacklisted_at else None,
        })
    
    return {
        "total_users": total_users,
        "active_users_7d": active_7d,
        "active_users_30d": active_30d,
        "blacklisted_users": blacklisted,
        "admin_count": admin_count,
        "recent_registrations": recent_list,
        "blacklist_records": bl_list,
    }


@router.get("/blacklist")
def get_blacklist(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """View all blacklist records."""
    records = db.query(Blacklist).order_by(Blacklist.blacklisted_at.desc()).all()
    result = []
    for bl in records:
        result.append({
            "user_id": str(bl.user_id),
            "email": bl.email,
            "reason": bl.reason,
            "blacklisted_at": bl.blacklisted_at.isoformat() if bl.blacklisted_at else None,
            "blacklisted_by": str(bl.blacklisted_by) if bl.blacklisted_by else None,
        })
    return {"blacklist": result, "total": len(result)}


@router.post("/blacklist-user")
def blacklist_user(
    data: BlacklistRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """Blacklist a user. Only black_admin."""
    target_id = uuid.UUID(data.user_id)
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot blacklist a black_admin
    black_emails = [e.strip().lower() for e in (settings.BLACK_ADMIN_EMAILS or "").split(",") if e.strip()]
    if target.email.lower() in black_emails:
        raise HTTPException(status_code=403, detail="Cannot blacklist a super admin.")
    
    # Set blacklisted flag on user
    target.is_blacklisted = True
    db.add(target)
    
    # Create blacklist audit record
    existing = db.query(Blacklist).filter(Blacklist.user_id == target_id).first()
    if existing:
        existing.reason = data.reason or "Blacklisted by admin"
        existing.blacklisted_at = datetime.now(timezone.utc)
        existing.blacklisted_by = current_user.id
        db.add(existing)
    else:
        bl = Blacklist(
            user_id=target_id,
            email=target.email,
            reason=data.reason or "Blacklisted by admin",
            blacklisted_by=current_user.id,
        )
        db.add(bl)
    
    db.commit()
    return {"message": f"User {target.email} has been blacklisted.", "success": True}


@router.post("/unblacklist-user")
def unblacklist_user(
    data: UnblacklistRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """Unblacklist a user. Only black_admin. Blacklist record is preserved (audit)."""
    target_id = uuid.UUID(data.user_id)
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target.is_blacklisted = False
    db.add(target)
    db.commit()
    
    # NOTE: blacklist record is NOT deleted — preserved for audit
    return {"message": f"User {target.email} has been unblacklisted.", "success": True}


@router.post("/promote-user")
def promote_user(
    data: PromoteRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """Promote a user to admin role. Only black_admin."""
    target_id = uuid.UUID(data.user_id)
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target.role == "admin":
        return {"message": "User is already an admin.", "success": True}
    
    if target.role == "black_admin":
        raise HTTPException(status_code=403, detail="Cannot modify a super admin.")
    
    target.role = "admin"
    db.add(target)
    db.commit()
    return {"message": f"User {target.email} promoted to admin.", "success": True}


@router.post("/demote-user")
def demote_user(
    data: DemoteRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """Demote an admin to user role. Only black_admin."""
    target_id = uuid.UUID(data.user_id)
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot demote black_admin
    black_emails = [e.strip().lower() for e in (settings.BLACK_ADMIN_EMAILS or "").split(",") if e.strip()]
    if target.email.lower() in black_emails:
        raise HTTPException(status_code=403, detail="Cannot demote a super admin.")
    
    if target.role == "user":
        return {"message": "User is already a regular user.", "success": True}
    
    target.role = "user"
    db.add(target)
    db.commit()
    return {"message": f"User {target.email} demoted to user.", "success": True}


@router.post("/delete-user")
def delete_user(
    data: DeleteUserRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_black_admin),
) -> Any:
    """Delete a user permanently. Only black_admin. Last resort after blacklist."""
    target_id = uuid.UUID(data.user_id)
    target = db.query(User).filter(User.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot delete black_admin
    black_emails = [e.strip().lower() for e in (settings.BLACK_ADMIN_EMAILS or "").split(",") if e.strip()]
    if target.email.lower() in black_emails:
        raise HTTPException(status_code=403, detail="Cannot delete a super admin.")
    
    # Cannot delete self
    if target.id == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete yourself.")
    
    email = target.email
    
    # Delete profile first (cascade should handle but be explicit)
    profile = db.query(Profile).filter(Profile.id == target_id).first()
    if profile:
        db.delete(profile)
    
    # Delete blacklist record
    bl = db.query(Blacklist).filter(Blacklist.user_id == target_id).first()
    if bl:
        db.delete(bl)
    
    db.delete(target)
    db.commit()
    
    return {"message": f"User {email} has been permanently deleted.", "success": True}
