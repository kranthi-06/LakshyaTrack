import multiprocessing
import os


def _default_workers() -> int:
    cpu = multiprocessing.cpu_count() or 1
    # Balanced default for API workloads; override with WEB_CONCURRENCY in env.
    return max(2, min(8, (cpu * 2) + 1))


bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
worker_class = "uvicorn.workers.UvicornWorker"
workers = int(os.getenv("WEB_CONCURRENCY", str(_default_workers())))
threads = int(os.getenv("GUNICORN_THREADS", "1"))

timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# Restart workers periodically to reduce long-tail memory fragmentation.
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "2000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "200"))

accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
