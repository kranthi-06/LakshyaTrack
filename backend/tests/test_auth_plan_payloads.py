from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api.endpoints import auth, users


def _build_user_fixture():
    now = datetime(2026, 3, 27, 12, 0, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
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
