import logging
from typing import Optional

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database
from pymongo.server_api import ServerApi

from app.core.config import settings

logger = logging.getLogger(__name__)

REQUIRED_COLLECTIONS = (
    "user_progress",
    "resume_analysis",
    "task_logs",
    "ai_outputs",
)

_mongo_client: Optional[MongoClient] = None
_mongo_db: Optional[Database] = None
_mongo_init_attempted = False


def _build_client(uri: str) -> MongoClient:
    return MongoClient(
        uri,
        server_api=ServerApi("1"),
        connectTimeoutMS=5000,
        serverSelectionTimeoutMS=5000,
    )


def _ensure_required_collections(db: Database) -> None:
    existing_collections = set(db.list_collection_names())
    for collection_name in REQUIRED_COLLECTIONS:
        if collection_name not in existing_collections:
            db.create_collection(collection_name)


def _ensure_indexes(db: Database) -> None:
    db["user_progress"].create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        name="user_progress_user_created_at_idx",
    )
    db["resume_analysis"].create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        name="resume_analysis_user_created_at_idx",
    )
    db["task_logs"].create_index(
        [("task_name", ASCENDING), ("created_at", DESCENDING)],
        name="task_logs_task_created_at_idx",
    )
    db["task_logs"].create_index(
        [("status", ASCENDING), ("created_at", DESCENDING)],
        name="task_logs_status_created_at_idx",
    )
    db["ai_outputs"].create_index(
        [("output_type", ASCENDING), ("created_at", DESCENDING)],
        name="ai_outputs_type_created_at_idx",
    )
    db["ai_outputs"].create_index(
        [("provider", ASCENDING), ("created_at", DESCENDING)],
        name="ai_outputs_provider_created_at_idx",
    )


def init_mongodb() -> Optional[Database]:
    global _mongo_client, _mongo_db, _mongo_init_attempted

    if _mongo_db is not None:
        return _mongo_db
    if _mongo_init_attempted:
        return None

    _mongo_init_attempted = True

    mongo_uri = (settings.MONGODB_URI or "").strip()
    if not mongo_uri:
        logger.warning("MONGODB_URI is not configured. MongoDB document storage is disabled.")
        return None

    try:
        _mongo_client = _build_client(mongo_uri)
        _mongo_client.admin.command("ping")
        _mongo_db = _mongo_client.get_database(settings.MONGODB_DB_NAME)
        _ensure_required_collections(_mongo_db)
        _ensure_indexes(_mongo_db)
        logger.info(
            "MongoDB Atlas connected successfully. Using database '%s'.",
            settings.MONGODB_DB_NAME,
        )
    except Exception:
        logger.exception("Failed to initialize MongoDB Atlas connection.")
        close_mongodb()
        _mongo_init_attempted = True
        return None

    return _mongo_db


def get_mongodb() -> Optional[Database]:
    if _mongo_db is not None:
        return _mongo_db
    return init_mongodb()


def get_collection(collection_name: str):
    db = get_mongodb()
    if db is None:
        return None
    return db[collection_name]


def close_mongodb() -> None:
    global _mongo_client, _mongo_db, _mongo_init_attempted

    if _mongo_client is not None:
        _mongo_client.close()

    _mongo_client = None
    _mongo_db = None
    _mongo_init_attempted = False
