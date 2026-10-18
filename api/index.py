import logging
import os
import sys
from typing import Optional


backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)


logger = logging.getLogger(__name__)


def _build_fallback_app(primary_error: Exception, secondary_error: Optional[Exception] = None):
    """Return a safe emergency app if the real ASGI app cannot import.

    Startup diagnostics belong in Vercel logs, not in an unauthenticated HTTP
    response where they can reveal paths, dependency state, or configuration.
    """
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    logger.exception(
        "LakshyaTrack application startup failed. primary=%r secondary=%r",
        primary_error,
        secondary_error,
    )

    debug_app = FastAPI()

    @debug_app.api_route(
        "/{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    )
    async def fallback(path: str):
        return JSONResponse(
            status_code=503,
            content={"detail": "Service temporarily unavailable"},
        )

    return debug_app


def _load_app():
    try:
        from app.main import app as fastapi_app

        return fastapi_app
    except Exception as primary_error:
        # Do not retry the application as top-level ``main`` after an import
        # failure.  That creates a second module namespace (``main`` versus
        # ``app.main``) and can execute declarative model definitions twice
        # against the same SQLAlchemy metadata, producing duplicate-table
        # registration errors that obscure the original failure.
        return _build_fallback_app(primary_error)


# Vercel's Python runtime looks for a module-level app/application/handler.
app = _load_app()
application = app
handler = app
