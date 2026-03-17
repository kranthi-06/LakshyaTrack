import logging
import base64
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel

from app.db.mongodb import get_collection
from app.core.config import settings

logger = logging.getLogger(__name__)


def _serialize_for_mongo(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {str(key): _serialize_for_mongo(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialize_for_mongo(item) for item in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, Decimal):
        return float(value)
    return value


def _insert_document(collection_name: str, payload: Dict[str, Any]) -> Optional[str]:
    collection = get_collection(collection_name)
    if collection is None:
        return None

    document = _serialize_for_mongo(payload)
    try:
        result = collection.insert_one(document)
        return str(result.inserted_id)
    except Exception:
        logger.exception("Failed to insert document into MongoDB collection '%s'.", collection_name)
        return None


def record_user_progress(
    user_id: str,
    progress_data: Dict[str, Any],
    snapshot_id: Optional[str] = None,
    source: str = "progress_snapshot",
) -> Optional[str]:
    return _insert_document(
        "user_progress",
        {
            "user_id": user_id,
            "snapshot_id": snapshot_id,
            "source": source,
            "progress": progress_data,
            "created_at": datetime.now(timezone.utc),
        },
    )


def record_resume_analysis(
    filename: str,
    analysis: Dict[str, Any],
    user_id: Optional[str] = None,
    resume_url: Optional[str] = None,
    job_description: str = "",
    source: str = "resume_upload",
) -> Optional[str]:
    return _insert_document(
        "resume_analysis",
        {
            "user_id": user_id,
            "filename": filename,
            "source": source,
            "job_description_provided": bool(job_description.strip()),
            "job_description_excerpt": job_description[:500] if job_description else "",
            "cloudinary_url": resume_url,
            "analysis": analysis,
            "created_at": datetime.now(timezone.utc),
        },
    )


def record_task_log(
    task_name: str,
    status: str,
    source: str,
    details: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
) -> Optional[str]:
    return _insert_document(
        "task_logs",
        {
            "task_name": task_name,
            "status": status,
            "source": source,
            "user_id": user_id,
            "details": details or {},
            "created_at": datetime.now(timezone.utc),
        },
    )


def record_ai_output(
    output_type: str,
    response: Any,
    provider: str,
    input_payload: Optional[Any] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    return _insert_document(
        "ai_outputs",
        {
            "output_type": output_type,
            "provider": provider,
            "input": input_payload,
            "response": response,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        },
    )


def get_ai_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    collection = get_collection("ai_cache")
    if collection is None:
        return None
    try:
        doc = collection.find_one({"cache_key": cache_key})
        if not doc:
            return None
        # If TTL index hasn't removed it yet, enforce expires_at here as well.
        expires_at = doc.get("expires_at")
        if expires_at and isinstance(expires_at, datetime):
            if expires_at < datetime.now(timezone.utc):
                return None
        return doc
    except Exception:
        logger.exception("Failed to read ai_cache for key '%s'.", cache_key)
        return None


def set_ai_cache(
    cache_key: str,
    response: Any,
    provider: str,
    input_payload: Optional[Any] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    collection = get_collection("ai_cache")
    if collection is None:
        return None

    created_at = datetime.now(timezone.utc)
    ttl_seconds = max(60, int(getattr(settings, "AI_CACHE_TTL_SECONDS", 0) or 0))
    expires_at = created_at + timedelta(seconds=ttl_seconds)

    payload = _serialize_for_mongo(
        {
            "cache_key": cache_key,
            "provider": provider,
            "input": input_payload,
            "response": response,
            "metadata": metadata or {},
            "created_at": created_at,
            "expires_at": expires_at,
        }
    )
    try:
        result = collection.update_one(
            {"cache_key": cache_key},
            {"$set": payload},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else None
    except Exception:
        logger.exception("Failed to write ai_cache for key '%s'.", cache_key)
        return None


def get_idempotency_record(idem_key: str) -> Optional[Dict[str, Any]]:
    collection = get_collection("idempotency_keys")
    if collection is None:
        return None
    try:
        doc = collection.find_one({"idem_key": idem_key})
        if not doc:
            return None
        expires_at = doc.get("expires_at")
        if expires_at and isinstance(expires_at, datetime):
            if expires_at < datetime.now(timezone.utc):
                return None
        return doc
    except Exception:
        logger.exception("Failed to read idempotency record for key '%s'.", idem_key)
        return None


def set_idempotency_record(
    idem_key: str,
    method: str,
    path: str,
    request_hash: str,
    status_code: int,
    response_body: bytes,
    response_content_type: str,
    response_headers: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    collection = get_collection("idempotency_keys")
    if collection is None:
        return None

    created_at = datetime.now(timezone.utc)
    ttl_seconds = max(60, int(getattr(settings, "IDEMPOTENCY_TTL_SECONDS", 0) or 0))
    expires_at = created_at + timedelta(seconds=ttl_seconds)

    payload = {
        "idem_key": idem_key,
        "method": method,
        "path": path,
        "request_hash": request_hash,
        "status_code": int(status_code),
        "content_type": response_content_type,
        "headers": response_headers or {},
        "response_body_b64": base64.b64encode(response_body).decode("ascii"),
        "created_at": created_at,
        "expires_at": expires_at,
    }
    try:
        result = collection.update_one(
            {"idem_key": idem_key},
            {"$set": _serialize_for_mongo(payload)},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else None
    except Exception:
        logger.exception("Failed to write idempotency record for key '%s'.", idem_key)
        return None
