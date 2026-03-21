"""
Hybrid async job queue:
- memory mode: in-process execution (current behavior)
- redis mode: distributed queue + metadata keys (worker-consumed)
- auto mode: redis when available, otherwise memory
"""
import asyncio
import json
import logging
import time
import uuid
from typing import Any, Awaitable, Callable, Dict, Optional

from app.core.config import settings


JobFactory = Callable[[], Awaitable[Any]]
logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover
    redis_async = None

_jobs: Dict[str, dict] = {}
_jobs_lock = asyncio.Lock()
_MAX_JOBS = 10000
_redis_client = None
_redis_url = None


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


async def _trim_jobs() -> None:
    # Remove old finished jobs first.
    if len(_jobs) <= _MAX_JOBS:
        return
    cutoff = time.time() - int(settings.JOB_QUEUE_TTL_SECONDS)
    to_delete = []
    for job_id, job in _jobs.items():
        finished_at_ts = job.get("finished_at_ts")
        if finished_at_ts and finished_at_ts < cutoff:
            to_delete.append(job_id)
    for job_id in to_delete:
        _jobs.pop(job_id, None)

    # Hard bound in case jobs are all recent.
    if len(_jobs) > _MAX_JOBS:
        overflow = len(_jobs) - _MAX_JOBS
        for job_id in list(_jobs.keys())[:overflow]:
            _jobs.pop(job_id, None)


def _queue_backend() -> str:
    raw = (settings.JOB_QUEUE_BACKEND or "auto").strip().lower()
    return raw if raw in {"auto", "memory", "redis"} else "auto"


def _use_redis_backend() -> bool:
    backend = _queue_backend()
    if backend == "memory":
        return False
    if not settings.REDIS_URL or redis_async is None:
        return False
    return True


async def _get_redis_client():
    global _redis_client, _redis_url
    if not _use_redis_backend():
        return None
    redis_url = settings.REDIS_URL
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


def _redis_job_key(job_id: str) -> str:
    return f"jobs:meta:{job_id}"


async def _redis_set_job(job: dict) -> None:
    client = await _get_redis_client()
    if client is None:
        return
    try:
        ttl = max(60, int(settings.JOB_QUEUE_TTL_SECONDS))
        await client.setex(_redis_job_key(job["job_id"]), ttl, json.dumps(job))
    except Exception:
        pass


async def _redis_get_job(job_id: str) -> Optional[dict]:
    client = await _get_redis_client()
    if client is None:
        return None
    try:
        raw = await client.get(_redis_job_key(job_id))
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def submit_job(
    job_type: str,
    factory: Optional[JobFactory] = None,
    payload: Optional[dict] = None,
) -> str:
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "job_type": job_type,
        "status": "queued",
        "created_at": _now_iso(),
        "started_at": None,
        "finished_at": None,
        "finished_at_ts": None,
        "result": None,
        "error": None,
    }

    # Distributed queue path (requires payload, worker will execute)
    if payload is not None:
        client = await _get_redis_client()
        if client is not None:
            await _redis_set_job(job)
            try:
                queue_item = {"job_id": job_id, "job_type": job_type, "payload": payload}
                await client.lpush(settings.JOB_QUEUE_REDIS_LIST_KEY, json.dumps(queue_item))
                return job_id
            except Exception:
                # Fall through to memory mode if redis push fails.
                pass

    # Memory path (existing behavior)
    if factory is None:
        raise ValueError("submit_job requires a factory for memory mode")

    async with _jobs_lock:
        _jobs[job_id] = dict(job)
        await _trim_jobs()

    async def _runner_memory():
        async with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id]["status"] = "running"
                _jobs[job_id]["started_at"] = _now_iso()
        try:
            result = await factory()
            async with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]["status"] = "completed"
                    _jobs[job_id]["result"] = result
                    _jobs[job_id]["finished_at"] = _now_iso()
                    _jobs[job_id]["finished_at_ts"] = time.time()
        except Exception as exc:
            async with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = str(exc)
                    _jobs[job_id]["finished_at"] = _now_iso()
                    _jobs[job_id]["finished_at_ts"] = time.time()

    asyncio.create_task(_runner_memory())
    return job_id


async def get_job(job_id: str) -> Optional[dict]:
    redis_job = await _redis_get_job(job_id)
    if redis_job is not None:
        return redis_job
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        # Return a shallow copy to avoid accidental mutation by caller.
        return dict(job)


async def run_worker_forever() -> None:
    """
    Redis worker loop for distributed async jobs.
    """
    client = await _get_redis_client()
    if client is None:
        raise RuntimeError("Redis job queue is not available. Configure REDIS_URL and JOB_QUEUE_BACKEND.")

    from app.services.job_executor import execute_job

    queue_key = settings.JOB_QUEUE_REDIS_LIST_KEY
    logger.info("Job worker started. queue=%s", queue_key)

    while True:
        try:
            item = await client.brpop(queue_key, timeout=5)
            if not item:
                continue
            _, raw = item
            task = json.loads(raw)
            job_id = task.get("job_id")
            job_type = task.get("job_type")
            payload = task.get("payload") or {}
            if not job_id or not job_type:
                continue

            job = await _redis_get_job(job_id) or {
                "job_id": job_id,
                "job_type": job_type,
                "created_at": _now_iso(),
                "result": None,
                "error": None,
            }
            job["status"] = "running"
            job["started_at"] = _now_iso()
            await _redis_set_job(job)

            try:
                result = await execute_job(job_type, payload)
                job["status"] = "completed"
                job["result"] = result
                job["error"] = None
            except Exception as exc:
                job["status"] = "failed"
                job["error"] = str(exc)
            finally:
                job["finished_at"] = _now_iso()
                job["finished_at_ts"] = time.time()
                await _redis_set_job(job)
        except Exception as exc:
            logger.warning("Job worker loop error: %s", str(exc))
            await asyncio.sleep(1)
