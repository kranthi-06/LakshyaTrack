from typing import Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from app.api import deps
from app.api.endpoints import saved_resumes as saved_resume_endpoints
from app.services import cloudinary_service, document_store_service, media_service, resume_service

router = APIRouter()

from app.models.user import Profile


class ResumeEditAliasRequest(saved_resume_endpoints.ResumeUpdateRequest):
    resume_id: str

@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(""),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload a resume (PDF) and get AI analysis.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        filename = file.filename or "resume.pdf"

        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Invalid file type. Only PDF allowed.")
        
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
            
        logger.info(f"Processing resume: {filename} ({len(content)} bytes)")

        upload_result = await cloudinary_service.upload_media(
            filename=filename,
            content=content,
            content_type=file.content_type,
            media_type=cloudinary_service.MediaType.RESUME,
            user_id=str(current_user.id) if current_user else None,
        )

        if current_user:
            media_service.persist_profile_media_url(
                db,
                current_user.id,
                cloudinary_service.MediaType.RESUME,
                upload_result.secure_url,
            )
            db.commit()

        try:
            text = await resume_service.extract_text_from_pdf(content)
        except Exception as e:
            logger.error(f"Text extraction failed: {str(e)}")
            raise HTTPException(status_code=400, detail="Failed to parse PDF content")
        
        if not text.strip():
            logger.warning(f"No text extracted from PDF: {filename}")
            raise HTTPException(status_code=400, detail="Could not extract text from PDF. It might be a scanned image or empty.")
            
        logger.info(f"Analysis started for {filename}")
        analysis = await resume_service.analyze_resume_with_ai(text, job_description)
        logger.info(f"Analysis completed for {filename}")

        user_id = str(current_user.id) if current_user else None
        document_store_service.record_resume_analysis(
            filename=filename,
            analysis=analysis,
            user_id=user_id,
            resume_url=upload_result.secure_url,
            job_description=job_description,
            source="resume_upload",
        )
        document_store_service.record_task_log(
            task_name="resume_analysis",
            status="success",
            source="api",
            user_id=user_id,
            details={
                "filename": filename,
                "cloudinary_url": upload_result.secure_url,
                "job_description_provided": bool(job_description.strip()),
            },
        )
        
        
        # --- NEW: Extract and auto-sync skills to profile ---
        if current_user and analysis and isinstance(analysis, dict):
            matched_skills = analysis.get("keyword_analysis", {}).get("matched", [])
            if matched_skills and isinstance(matched_skills, list):
                profile = db.query(Profile).filter(Profile.id == current_user.id).first()
                if not profile:
                    profile = Profile(id=current_user.id)
                    db.add(profile)
                
                current_skills = set(profile.skills or [])
                new_skills = current_skills.union(set([str(s).strip() for s in matched_skills]))
                
                profile.skills = list(new_skills)
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(profile, "skills")
                db.commit()

        return {
            "filename": filename,
            "analysis": analysis,
            "resume_url": upload_result.secure_url,
        }
    except HTTPException:
        document_store_service.record_task_log(
            task_name="resume_analysis",
            status="failed",
            source="api",
            user_id=str(current_user.id) if current_user else None,
            details={"filename": file.filename or "resume.pdf"},
        )
        raise
    except cloudinary_service.CloudinaryConfigurationError as e:
        logger.error(f"Cloudinary configuration error: {str(e)}")
        document_store_service.record_task_log(
            task_name="resume_analysis",
            status="failed",
            source="api",
            user_id=str(current_user.id) if current_user else None,
            details={"filename": file.filename or "resume.pdf", "error": str(e)},
        )
        raise HTTPException(status_code=500, detail="Media storage is not configured correctly")
    except ValueError as e:
        document_store_service.record_task_log(
            task_name="resume_analysis",
            status="failed",
            source="api",
            user_id=str(current_user.id) if current_user else None,
            details={"filename": file.filename or "resume.pdf", "error": str(e)},
        )
        raise HTTPException(status_code=400, detail="Invalid resume input")
    except Exception as e:
        logger.error(f"Unexpected error during resume analysis: {str(e)}", exc_info=True)
        document_store_service.record_task_log(
            task_name="resume_analysis",
            status="failed",
            source="api",
            user_id=str(current_user.id) if current_user else None,
            details={"filename": file.filename or "resume.pdf", "error": str(e)},
        )
        raise HTTPException(status_code=500, detail="Resume analysis failed")

@router.post("/analyze-text")
async def analyze_resume_text(
    text: str = Form(...),
    filename: str = Form("resume.txt"),
    job_description: str = Form(""),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_active_user),
) -> Any:
    """
    Analyze resume text directly (e.g., after client-side OCR).
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        if not text.strip():
            raise HTTPException(status_code=400, detail="Resume text is empty.")

        logger.info(f"Analysis started for text from {filename}")
        analysis = await resume_service.analyze_resume_with_ai(text, job_description)
        logger.info(f"Analysis completed for text from {filename}")

        # --- NEW: Extract and auto-sync skills to profile ---
        if current_user and analysis and isinstance(analysis, dict):
            matched_skills = analysis.get("keyword_analysis", {}).get("matched", [])
            if matched_skills and isinstance(matched_skills, list):
                profile = db.query(Profile).filter(Profile.id == current_user.id).first()
                if not profile:
                    profile = Profile(id=current_user.id)
                    db.add(profile)
                
                current_skills = set(profile.skills or [])
                new_skills = current_skills.union(set([str(s).strip() for s in matched_skills]))
                
                profile.skills = list(new_skills)
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(profile, "skills")
                db.commit()

        user_id = str(current_user.id) if current_user else None
        document_store_service.record_resume_analysis(
            filename=filename,
            analysis=analysis,
            user_id=user_id,
            job_description=job_description,
            source="resume_text",
        )
        document_store_service.record_task_log(
            task_name="resume_analysis_text",
            status="success",
            source="api",
            user_id=user_id,
            details={
                "filename": filename,
                "job_description_provided": bool(job_description.strip()),
            },
        )

        return {
            "filename": filename,
            "analysis": analysis
        }
    except HTTPException:
        document_store_service.record_task_log(
            task_name="resume_analysis_text",
            status="failed",
            source="api",
            user_id=str(current_user.id) if current_user else None,
            details={"filename": filename},
        )
        raise
    except Exception as e:
        logger.error(f"Unexpected error during resume text analysis: {str(e)}", exc_info=True)
        document_store_service.record_task_log(
            task_name="resume_analysis_text",
            status="failed",
            source="api",
            user_id=str(current_user.id) if current_user else None,
            details={"filename": filename, "error": str(e)},
        )
        raise HTTPException(status_code=500, detail="Resume text analysis failed")


@router.post("/upload")
async def upload_saved_resume(
    request: saved_resume_endpoints.ResumeSaveRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Alias for SaaS resume storage upload."""
    return await saved_resume_endpoints.save_resume(
        request=request,
        db=db,
        current_user=current_user,
    )


@router.get("/list")
async def list_saved_resumes(
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Alias for SaaS resume listing."""
    return await saved_resume_endpoints.get_saved_resumes(
        db=db,
        current_user=current_user,
    )


@router.post("/edit")
async def edit_saved_resume(
    request: ResumeEditAliasRequest,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Alias for SaaS resume edit."""
    update_payload = saved_resume_endpoints.ResumeUpdateRequest(
        resume_name=request.resume_name,
        resume_url=request.resume_url,
        resume_data=request.resume_data,
        template_id=request.template_id,
        theme=request.theme,
        target_role=request.target_role,
        ats_score=request.ats_score,
        is_primary=request.is_primary,
    )
    return await saved_resume_endpoints.update_saved_resume(
        resume_id=request.resume_id,
        request=update_payload,
        db=db,
        current_user=current_user,
    )


@router.delete("/{resume_id}")
async def delete_saved_resume_alias(
    resume_id: str,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Alias for SaaS resume delete."""
    return await saved_resume_endpoints.delete_saved_resume(
        resume_id=resume_id,
        db=db,
        current_user=current_user,
    )
