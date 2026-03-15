from dataclasses import dataclass
from enum import Enum
from io import BytesIO
from typing import Optional, Tuple
from urllib.parse import unquote, urlparse
from uuid import uuid4

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings


class CloudinaryConfigurationError(RuntimeError):
    """Raised when Cloudinary credentials are unavailable or malformed."""


class MediaType(str, Enum):
    RESUME = "resume"
    PROFILE_IMAGE = "profile_image"
    PORTFOLIO_IMAGE = "portfolio_image"
    CERTIFICATE = "certificate"
    PROJECT_IMAGE = "project_image"


@dataclass(frozen=True)
class UploadResult:
    secure_url: str
    public_id: str
    folder: str
    resource_type: str


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}
PDF_EXTENSIONS = {".pdf"}


MEDIA_RULES = {
    MediaType.RESUME: {
        "base_folder": "resumes",
        "resource_type": "raw",
        "extensions": PDF_EXTENSIONS,
        "mime_prefixes": ("application/pdf",),
        "max_bytes": 10 * 1024 * 1024,
        "overwrite": False,
    },
    MediaType.PROFILE_IMAGE: {
        "base_folder": "profile_images",
        "resource_type": "image",
        "extensions": IMAGE_EXTENSIONS,
        "mime_prefixes": ("image/",),
        "max_bytes": 8 * 1024 * 1024,
        "overwrite": True,
    },
    MediaType.CERTIFICATE: {
        "base_folder": "certificates",
        "resource_type": "auto",
        "extensions": IMAGE_EXTENSIONS | PDF_EXTENSIONS,
        "mime_prefixes": ("image/", "application/pdf"),
        "max_bytes": 12 * 1024 * 1024,
        "overwrite": False,
    },
    MediaType.PROJECT_IMAGE: {
        "base_folder": "projects",
        "resource_type": "image",
        "extensions": IMAGE_EXTENSIONS,
        "mime_prefixes": ("image/",),
        "max_bytes": 8 * 1024 * 1024,
        "overwrite": False,
    },
    MediaType.PORTFOLIO_IMAGE: {
        "base_folder": "projects",
        "resource_type": "image",
        "extensions": IMAGE_EXTENSIONS,
        "mime_prefixes": ("image/",),
        "max_bytes": 8 * 1024 * 1024,
        "overwrite": False,
    },
}


_cloudinary_configured = False


def _strip_secret_wrappers(value: str) -> str:
    return value.strip().strip("<>").strip()


def _resolve_cloudinary_credentials() -> Tuple[str, str, str]:
    cloud_name = _strip_secret_wrappers(settings.CLOUDINARY_CLOUD_NAME or "")
    api_key = _strip_secret_wrappers(settings.CLOUDINARY_API_KEY or "")
    api_secret = _strip_secret_wrappers(settings.CLOUDINARY_API_SECRET or "")

    if cloud_name and api_key and api_secret:
        return cloud_name, api_key, api_secret

    cloudinary_url_value = (settings.CLOUDINARY_URL or "").strip()
    if not cloudinary_url_value:
        raise CloudinaryConfigurationError(
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
        )

    parsed = urlparse(cloudinary_url_value)
    if parsed.scheme != "cloudinary":
        raise CloudinaryConfigurationError("CLOUDINARY_URL must start with cloudinary://")

    cloud_name = _strip_secret_wrappers(parsed.hostname or "")
    api_key = _strip_secret_wrappers(unquote(parsed.username or ""))
    api_secret = _strip_secret_wrappers(unquote(parsed.password or ""))

    if not cloud_name or not api_key or not api_secret:
        raise CloudinaryConfigurationError("CLOUDINARY_URL is missing the cloud name, API key, or API secret.")

    return cloud_name, api_key, api_secret


def ensure_cloudinary_configured() -> None:
    global _cloudinary_configured

    if _cloudinary_configured:
        return

    cloud_name, api_key, api_secret = _resolve_cloudinary_credentials()
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )
    _cloudinary_configured = True


def _validate_upload(
    *,
    filename: str,
    content: bytes,
    content_type: Optional[str],
    media_type: MediaType,
) -> None:
    rule = MEDIA_RULES[media_type]
    lowered_name = (filename or "").lower()
    extension = ""
    if "." in lowered_name:
        extension = lowered_name[lowered_name.rfind("."):]

    if extension not in rule["extensions"]:
        raise ValueError(f"Unsupported file extension for {media_type.value}.")

    if content_type:
        allowed = any(content_type.startswith(prefix) for prefix in rule["mime_prefixes"])
        if not allowed:
            raise ValueError(f"Unsupported content type for {media_type.value}.")

    if len(content) > rule["max_bytes"]:
        size_limit_mb = rule["max_bytes"] // (1024 * 1024)
        raise ValueError(f"{media_type.value.replace('_', ' ').title()} uploads must be {size_limit_mb}MB or smaller.")


def _build_public_id(media_type: MediaType) -> str:
    if media_type == MediaType.PROFILE_IMAGE:
        return "profile_image"
    return f"{media_type.value}_{uuid4().hex}"


def _optimized_image_url(public_id: str) -> str:
    optimized_url, _ = cloudinary_url(
        public_id,
        secure=True,
        resource_type="image",
        type="upload",
        fetch_format="auto",
        quality="auto",
        transformation=[{"width": 2000, "height": 2000, "crop": "limit"}],
    )
    return optimized_url


def _folder_for_upload(media_type: MediaType, user_id: Optional[str]) -> str:
    base_folder = MEDIA_RULES[media_type]["base_folder"]
    subject = f"user_{user_id}" if user_id else "anonymous"
    return f"{base_folder}/{subject}"


def _sync_upload(
    *,
    filename: str,
    content: bytes,
    content_type: Optional[str],
    media_type: MediaType,
    user_id: Optional[str] = None,
) -> UploadResult:
    import logging
    logger = logging.getLogger(__name__)

    ensure_cloudinary_configured()
    _validate_upload(filename=filename, content=content, content_type=content_type, media_type=media_type)

    rule = MEDIA_RULES[media_type]
    folder = _folder_for_upload(media_type, user_id)
    public_id = _build_public_id(media_type)
    upload_source = BytesIO(content)
    upload_source.name = filename

    try:
        upload_result = cloudinary.uploader.upload(
            upload_source,
            folder=folder,
            public_id=public_id,
            resource_type=rule["resource_type"],
            overwrite=rule["overwrite"],
            invalidate=rule["overwrite"],
            use_filename=False,
            unique_filename=not rule["overwrite"],
            timeout=30,  # 30 second timeout for Cloudinary API
        )
    except Exception as e:
        logger.error(
            "Cloudinary upload failed for %s (type=%s, user=%s): %s",
            filename, media_type.value, user_id, str(e),
        )
        raise ValueError(f"File upload failed: {str(e)}")

    secure_url = upload_result["secure_url"]
    if upload_result.get("resource_type") == "image":
        secure_url = _optimized_image_url(upload_result["public_id"])

    logger.info(
        "Cloudinary upload OK: %s → %s (user=%s)",
        filename, upload_result["public_id"], user_id,
    )

    return UploadResult(
        secure_url=secure_url,
        public_id=upload_result["public_id"],
        folder=folder,
        resource_type=upload_result["resource_type"],
    )


async def upload_media(
    *,
    filename: str,
    content: bytes,
    content_type: Optional[str],
    media_type: MediaType,
    user_id: Optional[str] = None,
) -> UploadResult:
    """Upload media to Cloudinary with error isolation."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        return await run_in_threadpool(
            _sync_upload,
            filename=filename,
            content=content,
            content_type=content_type,
            media_type=media_type,
            user_id=user_id,
        )
    except ValueError:
        raise  # Re-raise validation/upload errors
    except Exception as e:
        logger.error("Unexpected upload error: %s", str(e))
        raise ValueError(f"Upload failed unexpectedly: {str(e)}")
