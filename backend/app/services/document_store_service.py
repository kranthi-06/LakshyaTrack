import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel

from app.db.mongodb import get_collection

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
