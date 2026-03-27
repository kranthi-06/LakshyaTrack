import os
import sys
from typing import Optional


backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)


def _build_fallback_app(primary_error: Exception, secondary_error: Optional[Exception] = None):
    from fastapi import FastAPI, Request, Response

    debug_app = FastAPI()

    @debug_app.api_route(
        "/{path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    )
    async def fallback(request: Request, path: str):
        import traceback

        cwd = os.getcwd()
        files_cwd = os.listdir(cwd) if os.path.exists(cwd) else "N/A"

        parent = os.path.dirname(cwd)
        files_parent = os.listdir(parent) if os.path.exists(parent) else "N/A"

        error_details = f"""
        CRITICAL STARTUP ERROR
        ======================
        Primary Import Error: {primary_error}
        Secondary Import Error: {secondary_error}

        Traceback:
        {traceback.format_exc()}

        Environment:
        CWD: {cwd}
        Files in CWD: {files_cwd}
        Files in Parent: {files_parent}
        Sys Path: {sys.path}

        Request Details:
        Method: {request.method}
        Path: {path}
        """

        return Response(content=error_details, status_code=500, media_type="text/plain")

    return debug_app


def _load_app():
    try:
        from app.main import app as fastapi_app

        return fastapi_app
    except Exception as primary_error:
        fallback_backend_app_path = os.path.join(backend_path, "app")
        if fallback_backend_app_path not in sys.path:
            sys.path.append(fallback_backend_app_path)

        try:
            from main import app as fastapi_app

            return fastapi_app
        except Exception as secondary_error:
            return _build_fallback_app(primary_error, secondary_error)


# Vercel's Python runtime looks for a module-level app/application/handler.
app = _load_app()
application = app
handler = app
