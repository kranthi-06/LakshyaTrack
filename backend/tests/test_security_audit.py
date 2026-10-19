import asyncio
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile

from app.api.endpoints import quiz as quiz_endpoint
from app.api.endpoints import reasoning as reasoning_endpoint
from app.api.endpoints import resume as resume_endpoint
from app.api.endpoints import subscription as subscription_endpoint
from app.core.config import settings
from app.schemas.subscription import VerifyPaymentRequest
from app.services import cloudinary_service
from app.services import sandbox_controller as sandbox_module
from app.services import subscription_service


def test_sandbox_does_not_execute_on_host_when_fallback_disabled(monkeypatch):
    controller = sandbox_module.SandboxController()
    controller._docker_available = False
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "SANDBOX_ALLOW_UNSAFE_FALLBACK", False)
    monkeypatch.setattr(
        controller,
        "_fallback_execute",
        lambda *_args: pytest.fail("host fallback must not run"),
    )

    result = controller.execute("raise Exception()", "python", "")

    assert result["error"] == "Secure code execution is temporarily unavailable"
    assert result["exit_code"] == -1


def test_sandbox_never_allows_host_fallback_in_production(monkeypatch):
    controller = sandbox_module.SandboxController()
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "SANDBOX_ALLOW_UNSAFE_FALLBACK", True)
    monkeypatch.setattr(
        controller,
        "_fallback_execute",
        lambda *_args: pytest.fail("production must never run host fallback"),
    )

    result = controller._fallback_or_unavailable("pass", "python", "", 1)
    assert result["error"] == "Secure code execution is temporarily unavailable"


def test_auth_rate_limit_paths_cover_all_login_and_registration_routes():
    from app.main import RequestProtectionMiddleware

    auth_paths = (
        "/api/v1/signup",
        "/api/v1/send-otp",
        "/api/v1/verify-otp",
        "/api/v1/login/access-token",
        "/api/v1/google-login",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
    )
    for path in auth_paths:
        assert RequestProtectionMiddleware._is_auth_path(path), path

    assert not RequestProtectionMiddleware._is_auth_path("/api/v1/quiz/generate")
    assert not RequestProtectionMiddleware._is_auth_path("/api/v1/learning-content/refresh")


def test_request_protection_rejects_an_oversized_declared_body(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.main import RequestProtectionMiddleware

    monkeypatch.setattr(settings, "MAX_REQUEST_BODY_BYTES", 1024)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    inner = FastAPI()

    @inner.post("/echo")
    def echo():
        return {"ok": True}

    client = TestClient(RequestProtectionMiddleware(inner))
    response = client.post("/echo", content=b"x" * 2048)

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body is too large."


def test_login_attempts_use_the_strict_auth_rate_limit(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.core import resilience
    from app.main import RequestProtectionMiddleware

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_BACKEND", "memory")
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_MINUTE", 1)
    resilience._rate_limiters.clear()
    resilience._rate_limiters_last_seen.clear()

    inner = FastAPI()

    @inner.post("/api/v1/login/access-token")
    def login():
        return {"ok": True}

    client = TestClient(RequestProtectionMiddleware(inner))
    assert client.post("/api/v1/login/access-token").status_code == 200
    limited = client.post("/api/v1/login/access-token")

    assert limited.status_code == 429
    assert limited.json()["detail"] == "Too many requests. Please slow down."


def test_media_upload_validation_rejects_unsupported_extension_mime_and_content():
    with pytest.raises(ValueError):
        cloudinary_service._validate_upload(
            filename="payload.exe",
            content=b"MZ",
            content_type="application/octet-stream",
            media_type=cloudinary_service.MediaType.RESUME,
        )

    with pytest.raises(ValueError):
        cloudinary_service._validate_upload(
            filename="resume.pdf",
            content=b"<html>not a pdf</html>",
            content_type="application/pdf",
            media_type=cloudinary_service.MediaType.RESUME,
        )

    with pytest.raises(ValueError):
        cloudinary_service._validate_upload(
            filename="avatar.png",
            content=b"\x89PNG\r\n\x1a\nimage",
            content_type="text/html",
            media_type=cloudinary_service.MediaType.PROFILE_IMAGE,
        )


def test_media_upload_validation_accepts_matching_content_signatures():
    cloudinary_service._validate_upload(
        filename="resume.pdf",
        content=b"%PDF-1.7\nreal content",
        content_type="application/pdf",
        media_type=cloudinary_service.MediaType.RESUME,
    )
    cloudinary_service._validate_upload(
        filename="avatar.jpg",
        content=b"\xff\xd8\xff\xe0image",
        content_type="image/jpeg",
        media_type=cloudinary_service.MediaType.PROFILE_IMAGE,
    )


def test_production_payment_verification_returns_503_without_touching_pending_transaction(monkeypatch):
    pending = SimpleNamespace(status="pending")

    class NoQueryDatabase:
        def query(self, *_args):
            raise AssertionError("disabled verification must not query or modify transactions")

    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "PAYMENTS_DEMO_MODE", True)
    result = subscription_service.verify_payment_and_activate(NoQueryDatabase(), uuid4(), uuid4())
    assert result == {
        "success": False,
        "message": "Online payment verification is not configured yet.",
    }
    assert pending.status == "pending"

    with pytest.raises(HTTPException) as raised:
        subscription_endpoint.verify_payment(
            VerifyPaymentRequest(transaction_id=uuid4()),
            db=NoQueryDatabase(),
            current_user=SimpleNamespace(id=uuid4()),
        )
    assert raised.value.status_code == 503
    assert raised.value.detail == "Online payment verification is not configured yet."


def test_demo_payments_require_the_explicit_demo_flag(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "PAYMENTS_DEMO_MODE", False)

    assert subscription_service.payments_are_verifiable() is False

    monkeypatch.setattr(settings, "PAYMENTS_DEMO_MODE", True)

    assert subscription_service.payments_are_verifiable() is True


def test_reasoning_submissions_ignore_body_user_id(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        reasoning_endpoint,
        "save_test_result",
        lambda **kwargs: captured.update(kwargs) or "test-id",
    )
    monkeypatch.setattr(
        reasoning_endpoint,
        "record_user_answer",
        lambda **kwargs: captured.update(kwargs),
    )

    test_request = reasoning_endpoint.SubmitTestRequest(
        user_id="victim",
        test_type="topic_test",
        category="Python",
        answers=[],
        score=0,
        total=1,
    )
    answer_request = reasoning_endpoint.SubmitAnswerRequest(
        user_id="victim",
        question_id="q1",
        topic="Python",
        is_correct=False,
    )
    current_user = SimpleNamespace(id="authenticated-user")
    asyncio.run(reasoning_endpoint.submit_test(test_request, current_user=current_user))
    assert captured["user_id"] == "authenticated-user"
    asyncio.run(reasoning_endpoint.submit_answer(answer_request, current_user=current_user))
    assert captured["user_id"] == "authenticated-user"


def test_reasoning_progress_denies_other_users(monkeypatch):
    user = SimpleNamespace(id=uuid4(), email="student@example.test", role="user")
    monkeypatch.setattr(reasoning_endpoint, "get_user_progress", lambda _user_id: [])
    with pytest.raises(HTTPException) as raised:
        asyncio.run(reasoning_endpoint.user_progress(str(uuid4()), current_user=user))
    assert raised.value.status_code == 403


@pytest.mark.parametrize(
    ("content", "expected_status"),
    [
        pytest.param(b"%PDF-" + b"x" * (10 * 1024 * 1024), 413, id="oversized"),
        pytest.param(b"not a PDF", 400, id="invalid-pdf-magic"),
    ],
)
def test_resume_analyze_rejects_oversize_or_invalid_pdf(monkeypatch, content, expected_status):
    monkeypatch.setattr(resume_endpoint.document_store_service, "record_task_log", lambda **_kwargs: None)
    upload = UploadFile(filename="resume.pdf", file=BytesIO(content))
    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            resume_endpoint.analyze_resume(
                file=upload,
                job_description="",
                db=SimpleNamespace(),
                current_user=SimpleNamespace(id=uuid4()),
            )
        )
    assert raised.value.status_code == expected_status


def test_quiz_generation_failure_surfaces_retryable_503(monkeypatch):
    async def unavailable(*_args):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(quiz_endpoint.quiz_service, "generate_quiz", unavailable)
    request = quiz_endpoint.QuizRequest(topic="Python", count=2)
    with pytest.raises(HTTPException) as raised:
        asyncio.run(quiz_endpoint.generate_quiz(request, current_user=None))
    assert raised.value.status_code == 503
    assert raised.value.detail == "AI question generation is temporarily unavailable, please retry"
