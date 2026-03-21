"""
Lightweight response cache utility.
- Uses Redis when configured and available.
- Falls back to in-memory TTL cache automatically.
"""
import asyncio
import json
import time
from typing import Any, Optional

from app.core.config import settings

try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover - optional runtime dependency
    redis_async = None


_redis_client = None
_redis_url: Optional[str] = None
_cache_lock = asyncio.Lock()
_local_cache: dict[str, tuple[float, Any]] = {}


async def _get_redis_client():
    global _redis_client, _redis_url
    redis_url = (settings.REDIS_URL or "").strip()
    if not redis_url or redis_async is None:
        return None
    if _redis_client is not None and _redis_url == redis_url:
        return _redis_client
    try:
        client = redis_async.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        await client.ping()
        _redis_client = client
        _redis_url = redis_url
        return _redis_client
    except Exception:
        _redis_client = None
        _redis_url = redis_url
        return None


async def cache_get_json(key: str) -> Optional[Any]:
    client = await _get_redis_client()
    if client is not None:
        try:
            raw = await client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass

    # Fallback: in-memory TTL cache
    now = time.monotonic()
    entry = _local_cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if expires_at <= now:
        _local_cache.pop(key, None)
        return None
    return value


async def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    ttl = max(1, int(ttl_seconds))
    client = await _get_redis_client()
    if client is not None:
        try:
            await client.setex(key, ttl, json.dumps(value))
            return
        except Exception:
            pass

    # Fallback: in-memory TTL cache
    async with _cache_lock:
        _local_cache[key] = (time.monotonic() + ttl, value)
        # Keep memory bounded.
        if len(_local_cache) > 5000:
            now = time.monotonic()
            stale_keys = [k for k, (exp, _) in _local_cache.items() if exp <= now]
            for stale_key in stale_keys[:2000]:
                _local_cache.pop(stale_key, None)


async def cache_delete(key: str) -> None:
    client = await _get_redis_client()
    if client is not None:
        try:
            await client.delete(key)
        except Exception:
            pass
    _local_cache.pop(key, None)


async def cache_delete_prefix(prefix: str) -> None:
    client = await _get_redis_client()
    if client is not None:
        try:
            cursor = 0
            pattern = f"{prefix}*"
            while True:
                cursor, keys = await client.scan(cursor=cursor, match=pattern, count=500)
                if keys:
                    await client.delete(*keys)
                if cursor == 0:
                    break
        except Exception:
            pass

    async with _cache_lock:
        keys = [k for k in _local_cache.keys() if k.startswith(prefix)]
        for key in keys:
            _local_cache.pop(key, None)
