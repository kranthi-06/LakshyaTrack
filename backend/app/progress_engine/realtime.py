from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from threading import Lock
from typing import Any, Dict, Optional, Tuple

from . import redis_client

logger = logging.getLogger(__name__)

_local_subscribers: dict[str, dict[str, asyncio.Queue[str]]] = defaultdict(dict)
_subscriber_lock = Lock()


def _channel_name(user_id: str) -> str:
    return f"{redis_client.PREFIX}stream:{user_id}"


def subscribe_local(user_id: str) -> Tuple[str, asyncio.Queue[str]]:
    subscriber_id = str(uuid.uuid4())
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
    with _subscriber_lock:
        _local_subscribers[user_id][subscriber_id] = queue
    return subscriber_id, queue


def unsubscribe_local(user_id: str, subscriber_id: str) -> None:
    with _subscriber_lock:
        subscribers = _local_subscribers.get(user_id)
        if not subscribers:
            return
        subscribers.pop(subscriber_id, None)
        if not subscribers:
            _local_subscribers.pop(user_id, None)


def _publish_local(user_id: str, message: str) -> None:
    with _subscriber_lock:
        queues = list(_local_subscribers.get(user_id, {}).values())

    for queue in queues:
        if queue.full():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            logger.debug("Progress realtime queue full for user %s", user_id)


def publish_user_update(user_id: str, payload: Dict[str, Any]) -> None:
    message = json.dumps(payload, default=str)
    redis_conn = redis_client._get_redis()
    if redis_conn is not None:
        try:
            redis_conn.publish(_channel_name(user_id), message)
            return
        except Exception:
            logger.debug("Redis progress realtime publish failed.", exc_info=True)

    _publish_local(user_id, message)


def open_pubsub(user_id: str):
    redis_conn = redis_client._get_redis()
    if redis_conn is None:
        return None

    try:
        pubsub = redis_conn.pubsub(ignore_subscribe_messages=True)
        pubsub.subscribe(_channel_name(user_id))
        return pubsub
    except Exception:
        logger.debug("Redis progress realtime subscribe failed.", exc_info=True)
        return None


def read_pubsub_message(pubsub, timeout_seconds: float = 1.0) -> Optional[str]:
    try:
        message = pubsub.get_message(ignore_subscribe_messages=True, timeout=timeout_seconds)
    except Exception:
        logger.debug("Redis progress realtime read failed.", exc_info=True)
        return None

    if not message:
        return None

    data = message.get("data")
    if data is None:
        return None

    if isinstance(data, bytes):
        return data.decode("utf-8")
    if isinstance(data, str):
        return data
    return json.dumps(data, default=str)
