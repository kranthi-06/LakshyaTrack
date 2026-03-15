
import logging
import time
import traceback
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Use structured logging
logger = logging.getLogger("vidyamithra.middleware")


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """
    Production-grade error logging middleware.
    Catches all unhandled exceptions and:
      - Logs full traceback with request context
      - Returns a safe 500 response (never leaks internals)
      - Records request duration for slow-request detection
    """

    SLOW_REQUEST_MS = 3000  # Log requests slower than 3s

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000

            # Log slow requests
            if duration_ms > self.SLOW_REQUEST_MS:
                logger.warning(
                    "SLOW: %s %s → %d (%.0fms)",
                    method, path, response.status_code, duration_ms,
                )

            return response

        except Exception as e:
            duration_ms = (time.perf_counter() - start) * 1000
            error_id = f"MW-{int(time.time())}"

            logger.error(
                "[%s] Unhandled exception on %s %s (%.0fms): %s\n%s",
                error_id, method, path, duration_ms,
                str(e), traceback.format_exc(),
            )

            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal Server Error",
                    "error_id": error_id,
                },
            )
