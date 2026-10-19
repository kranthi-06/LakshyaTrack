from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api.endpoints import auth, users
from app.api import deps
from app.db.session import get_db
from app.main import app
from app.services.subscription_service import SubscriptionStateUnavailableError
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from app.services import subscription_service


def _build_user_fixture():
    now = datetime(2026, 3, 27, 12, 0, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id="1",  # Use string/integer instead of UUID for SQLite compatibility
        email="user@example.com",
        login_type="custom",
        is_active=True,
        is_superuser=False,
        role="user",
        is_blacklisted=False,
        last_active_at=now,
        created_at=now,
        updated_at=now,
        profile=None,
    )


def test_build_user_response_payload_includes_subscription_status(monkeypatch):
    user = _build_user_fixture()
    expected_status = {
        "plan": "professional",
        "status": "active",
        "stage": 2,
        "expires_at": None,
        "is_admin": False,
        "features": {"resume_download": True},
        "feature_expires": {},
        "subscription_id": None,
        "plan_name": "Professional Monthly",
    }

    monkeypatch.setattr(auth.crud, "get_user", lambda db, user_id: user)
    monkeypatch.setattr(auth.deps, "_resolve_user_role", lambda hydrated_user: "user")
    monkeypatch.setattr(auth, "get_subscription_status", lambda db, user_id, role: expected_status)

    payload = auth._build_user_response_payload(object(), user)

    assert payload["email"] == "user@example.com"
    assert payload["subscription_status"] == expected_status


def test_read_user_me_includes_subscription_status(monkeypatch):
    user = _build_user_fixture()
    expected_status = {
        "plan": "starter",
        "status": "active",
        "stage": 1,
        "expires_at": None,
        "is_admin": False,
        "features": {"roadmap_generate": True},
        "feature_expires": {},
        "subscription_id": "sub-1",
        "plan_name": "Starter Monthly",
    }

    monkeypatch.setattr(users.deps, "_resolve_user_role", lambda current_user: "user")
    monkeypatch.setattr(users, "get_subscription_status", lambda db, user_id, role: expected_status)

    payload = users.read_user_me(db=object(), current_user=user)

    assert payload["email"] == "user@example.com"
    assert payload["subscription_status"] == expected_status


def test_read_user_me_serializes_postgres_uuid_identifiers(monkeypatch):
    """Regression: production PostgreSQL UUIDs must satisfy the user schema."""
    user = _build_user_fixture()
    user.id = uuid4()
    user.profile = SimpleNamespace(
        id=user.id,
        full_name="Test User",
        profile_photo_url=None,
        profile_image_url=None,
        resume_url=None,
        certificate_url=None,
        project_image_url=None,
        phone_number=None,
        bio=None,
        links={},
        skills=[],
        activity_log=[],
        role="user",
        is_blacklisted=False,
        last_active_at=user.last_active_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
    monkeypatch.setattr(users.deps, "_resolve_user_role", lambda current_user: "user")
    monkeypatch.setattr(users, "get_subscription_status", lambda *_args: {"plan": "free"})

    payload = users.read_user_me(db=object(), current_user=user)

    assert payload["id"] == user.id
    assert payload["profile"]["id"] == user.id


def test_read_user_me_reports_subscription_database_failure_without_fake_plan(monkeypatch):
    """Regression: a missing/broken subscription table must not become a 500 or free plan."""
    user = _build_user_fixture()

    monkeypatch.setattr(users.deps, "_resolve_user_role", lambda current_user: "user")

    def fail_subscription_query(*_args, **_kwargs):
        raise SubscriptionStateUnavailableError("subscription table unavailable")

    monkeypatch.setattr(users, "get_subscription_status", fail_subscription_query)

    try:
        users.read_user_me(db=object(), current_user=user)
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "Subscription service temporarily unavailable"
    else:
        raise AssertionError("Expected subscription dependency failure to be surfaced")


def test_subscription_query_failure_is_typed_not_fabricated(monkeypatch):
    """The original database failure path must be observable to API callers."""
    user_id = uuid4()
    subscription_service.invalidate_subscription_cache(user_id)

    class BrokenDatabase:
        def query(self, *_args, **_kwargs):
            raise OperationalError("SELECT", {}, RuntimeError("missing relation"))

    try:
        subscription_service.get_subscription_status(BrokenDatabase(), user_id)
    except SubscriptionStateUnavailableError as exc:
        assert "temporarily unavailable" in str(exc)
    else:
        raise AssertionError("Expected typed subscription storage failure")


def test_subscription_absence_is_an_authoritative_free_status(monkeypatch):
    """No subscription row is a valid state, unlike a failed SQL query."""
    user_id = uuid4()
    subscription_service.invalidate_subscription_cache(user_id)
    monkeypatch.setattr(
        subscription_service,
        "resolve_feature_access",
        lambda *_args: {
            "stage": 0,
            "subscription": None,
            "features": {"resume_download": False},
            "feature_expires": {},
        },
    )

    status = subscription_service.get_subscription_status(object(), user_id)

    assert status["plan"] == "free"
    assert status["status"] == "none"
    assert status["subscription_id"] is None


def test_users_me_http_serializes_uuid_and_subscription_status(monkeypatch):
    user = _build_user_fixture()
    user.id = uuid4()
    user.profile = None
    expected_status = {"plan": "free", "status": "none", "stage": 0, "features": {}}

    monkeypatch.setattr(users, "get_subscription_status", lambda *_args: expected_status)
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[deps.get_current_active_user] = lambda: user
    try:
        response = TestClient(app).get("/api/v1/users/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id"] == str(user.id)
    assert response.json()["subscription_status"] == expected_status


def test_users_me_http_returns_safe_503_on_subscription_database_failure(monkeypatch):
    user = _build_user_fixture()

    def fail_subscription_query(*_args, **_kwargs):
        raise SubscriptionStateUnavailableError("database unavailable")

    monkeypatch.setattr(users, "get_subscription_status", fail_subscription_query)
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[deps.get_current_active_user] = lambda: user
    try:
        response = TestClient(app).get("/api/v1/users/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Subscription service temporarily unavailable"}


def test_users_me_http_unexpected_error_has_no_internal_details(monkeypatch):
    user = _build_user_fixture()

    def fail_validation(*_args, **_kwargs):
        raise RuntimeError("internal schema detail must not reach the client")

    monkeypatch.setattr(users.schemas.user.User, "model_validate", fail_validation)
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[deps.get_current_active_user] = lambda: user
    try:
        response = TestClient(app).get("/api/v1/users/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"
    assert "internal schema detail" not in response.text


def test_users_me_http_requires_authentication():
    response = TestClient(app).get("/api/v1/users/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
