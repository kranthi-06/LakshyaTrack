from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api import deps
from app.services import cloudinary_service, media_service

router = APIRouter()


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    media_type: cloudinary_service.MediaType = Form(...),
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        upload_result = await cloudinary_service.upload_media(
            filename=file.filename or f"{media_type.value}.bin",
            content=content,
            content_type=file.content_type,
            media_type=media_type,
            user_id=str(current_user.id),
        )

        persisted_field = media_service.persist_profile_media_url(
            db,
            current_user.id,
            media_type,
            upload_result.secure_url,
        )
        db.commit()

        return {
            "media_type": media_type.value,
            "secure_url": upload_result.secure_url,
            "folder": upload_result.folder,
            "persisted_field": persisted_field,
        }
    except HTTPException:
        raise
    except cloudinary_service.CloudinaryConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload media: {exc}")
