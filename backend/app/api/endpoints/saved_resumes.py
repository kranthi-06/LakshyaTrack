from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.models.resume import SavedResume
from app.models.user import Profile
from app.middleware.require_usage_limit import require_usage_limit
from app.services.usage_service import increment_usage

router = APIRouter()

class ResumeSaveRequest(BaseModel):
    resume_name: str = "Untitled Resume"
    resume_url: Optional[str] = None
    resume_data: Dict[str, Any]
    template_id: str = "modern"
    theme: str = "default"
    target_role: Optional[str] = None
    ats_score: Optional[float] = None
    is_primary: bool = False

def extract_skills_from_resume(resume_data: Dict[str, Any]) -> List[str]:
    """Helper to extract skills efficiently from structured resume data."""
    extracted = set()
    
    # Check top-level skills section
    skills_section = resume_data.get("skills", {})
    if isinstance(skills_section, dict):
        if "categories" in skills_section:
            for category in skills_section["categories"]:
                for item in category.get("items", []):
                    if isinstance(item, str):
                        extracted.add(item.strip())
                    elif isinstance(item, dict) and "name" in item:
                        extracted.add(item["name"].strip())
        elif "items" in skills_section:
            for item in skills_section["items"]:
                if isinstance(item, str):
                    extracted.add(item.strip())
                elif isinstance(item, dict) and "name" in item:
                    extracted.add(item["name"].strip())
                    
    # Can also add logic here to extract keywords from summary, text, etc if needed

    return [s for s in extracted if s]

@router.post("/")
async def save_resume(
    request: ResumeSaveRequest,
    db: Session = Depends(deps.get_db),
    current_user = Depends(require_usage_limit("resume_count")),
) -> Any:
    """Save a resume and intelligently sync skills. Enforces resume_count limit (monthly)."""
    
    # 1. Deal with is_primary
    if request.is_primary:
        db.query(SavedResume).filter(
            SavedResume.user_id == current_user.id
        ).update({"is_primary": False})
        
    # 2. Create a new resume record
    new_resume = SavedResume(
        user_id=current_user.id,
        resume_name=request.resume_name,
        resume_url=request.resume_url,
        resume_data=request.resume_data,
        template_id=request.template_id,
        theme=request.theme,
        target_role=request.target_role,
        ats_score=request.ats_score,
        is_primary=request.is_primary
    )
    db.add(new_resume)
    
    # 3. Sync extracted skills to Profile
    extracted_skills = extract_skills_from_resume(request.resume_data)
    if extracted_skills:
        profile = db.query(Profile).filter(Profile.id == current_user.id).first()
        if not profile:
            profile = Profile(id=current_user.id)
            db.add(profile)
            
        current_skills = set(profile.skills or [])
        new_skills = current_skills.union(set(extracted_skills))
        
        profile.skills = list(new_skills)
        # SQLAlchemy JSON trick to force update
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(profile, "skills")
        
    db.commit()
    db.refresh(new_resume)

    # Increment resume creation count after successful save (resets monthly)
    increment_usage(db, current_user.id, "resume_count")

    return {"message": "Resume saved successfully", "id": str(new_resume.id)}

@router.get("/")
async def get_saved_resumes(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """Get all saved resumes for the user, with explicit serialization."""
    resumes = db.query(SavedResume).filter(
        SavedResume.user_id == current_user.id
    ).order_by(SavedResume.created_at.desc()).all()
    
    # Explicitly serialize to avoid slow ORM lazy-loading and 
    # ensure JSON-safe output (UUIDs, datetimes, etc.)
    serialized = []
    for r in resumes:
        serialized.append({
            "id": str(r.id),
            "user_id": str(r.user_id),
            "resume_name": r.resume_name,
            "resume_url": r.resume_url,
            "resume_data": r.resume_data,
            "template_id": r.template_id,
            "theme": r.theme,
            "target_role": r.target_role,
            "ats_score": r.ats_score,
            "is_primary": r.is_primary,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    
    return {"resumes": serialized}

class ResumeUpdateRequest(BaseModel):
    resume_name: Optional[str] = None
    resume_url: Optional[str] = None
    resume_data: Optional[Dict[str, Any]] = None
    template_id: Optional[str] = None
    theme: Optional[str] = None
    target_role: Optional[str] = None
    ats_score: Optional[float] = None
    is_primary: Optional[bool] = None

@router.put("/{resume_id}")
async def update_saved_resume(
    resume_id: str,
    request: ResumeUpdateRequest,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """Update an existing saved resume. Edits are unlimited for all plans."""
    resume = db.query(SavedResume).filter(
        SavedResume.id == resume_id,
        SavedResume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    # Update fields that were provided
    if request.resume_name is not None:
        resume.resume_name = request.resume_name
    if request.resume_url is not None:
        resume.resume_url = request.resume_url
    if request.resume_data is not None:
        resume.resume_data = request.resume_data
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(resume, "resume_data")
    if request.template_id is not None:
        resume.template_id = request.template_id
    if request.theme is not None:
        resume.theme = request.theme
    if request.target_role is not None:
        resume.target_role = request.target_role
    if request.ats_score is not None:
        resume.ats_score = request.ats_score
    if request.is_primary is not None:
        if request.is_primary:
            db.query(SavedResume).filter(
                SavedResume.user_id == current_user.id,
                SavedResume.id != resume_id
            ).update({"is_primary": False})
        resume.is_primary = request.is_primary
    
    # Sync extracted skills to Profile if resume_data was updated
    if request.resume_data:
        extracted_skills = extract_skills_from_resume(request.resume_data)
        if extracted_skills:
            profile = db.query(Profile).filter(Profile.id == current_user.id).first()
            if not profile:
                profile = Profile(id=current_user.id)
                db.add(profile)
            current_skills = set(profile.skills or [])
            new_skills = current_skills.union(set(extracted_skills))
            profile.skills = list(new_skills)
            from sqlalchemy.orm.attributes import flag_modified as fm
            fm(profile, "skills")
    
    db.commit()
    db.refresh(resume)

    return {"message": "Resume updated successfully", "id": str(resume.id)}

@router.delete("/{resume_id}")
async def delete_saved_resume(
    resume_id: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """Delete a saved resume."""
    resume = db.query(SavedResume).filter(
        SavedResume.id == resume_id,
        SavedResume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    db.delete(resume)
    db.commit()

    return {"message": "Resume deleted successfully"}
