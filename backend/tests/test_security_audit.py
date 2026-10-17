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


def test_nonproduction_demo_payment_still_activates_transaction(monkeypatch):
    transaction = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        status="pending",
        order_type="micro",
        plan_id=uuid4(),
        coupon_code=None,
        discount=0,
        final_amount=10,
    )
    micro_plan = SimpleNamespace(id=transaction.plan_id, duration_hours=1, feature_key="resume_download")

    class Query:
        def __init__(self, model):
            self.model = model

        def filter(self, *_args):
            return self

        def first(self):
            if self.model is subscription_service.PaymentTransaction:
                return transaction
            return micro_plan

    class Database:
        def query(self, model):
            return Query(model)

        def add(self, _value):
            pass

        def commit(self):
            pass

        def refresh(self, _value):
            pass

    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "PAYMENTS_DEMO_MODE", True)
    result = subscription_service.verify_payment_and_activate(
        Database(),
        transaction.id,
        transaction.user_id,
    )
    assert result["success"] is True
    assert transaction.status == "success"


def test_reasoning_submissions_ignore_anonymous_body_user_id(monkeypatch):
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
    asyncio.run(reasoning_endpoint.submit_test(test_request, current_user=None))
    assert captured["user_id"] == "anonymous"
    asyncio.run(reasoning_endpoint.submit_answer(answer_request, current_user=None))
    assert captured["user_id"] == "anonymous"


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
