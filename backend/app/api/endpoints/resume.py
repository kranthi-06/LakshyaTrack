from typing import Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from app.api import deps
from app.services import cloudinary_service, media_service, resume_service

router = APIRouter()

from app.models.user import Profile

@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(""),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user_optional),
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
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF content: {str(e)}")
        
        if not text.strip():
            logger.warning(f"No text extracted from PDF: {filename}")
            raise HTTPException(status_code=400, detail="Could not extract text from PDF. It might be a scanned image or empty.")
            
        logger.info(f"Analysis started for {filename}")
        analysis = await resume_service.analyze_resume_with_ai(text, job_description)
        logger.info(f"Analysis completed for {filename}")
        
        
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
        raise
    except cloudinary_service.CloudinaryConfigurationError as e:
        logger.error(f"Cloudinary configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during resume analysis: {str(e)}", exc_info=True)
        # Exposing error for user debugging
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")

@router.post("/analyze-text")
async def analyze_resume_text(
    text: str = Form(...),
    filename: str = Form("resume.txt"),
    job_description: str = Form(""),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user_optional),
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

        return {
            "filename": filename,
            "analysis": analysis
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during resume text analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Engine Error (Text): {str(e)}")
