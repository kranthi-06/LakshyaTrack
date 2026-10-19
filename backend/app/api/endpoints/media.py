import logging
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api import deps
from app.services import cloudinary_service, media_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    media_type: cloudinary_service.MediaType = Form(...),
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    try:
        rule = cloudinary_service.MEDIA_RULES.get(media_type)
        if rule is None:
            raise HTTPException(status_code=400, detail="Unsupported media type.")

        # Bound the read so an oversized upload cannot exhaust worker memory
        # before validation runs.
        content = await file.read(rule["max_bytes"] + 1)
        if len(content) > rule["max_bytes"]:
            size_limit_mb = rule["max_bytes"] // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"Uploads must be {size_limit_mb}MB or smaller.",
            )
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
    except Exception:
        logger.exception("Media upload failed")
        raise HTTPException(status_code=500, detail="Failed to upload media.")
