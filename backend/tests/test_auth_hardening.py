from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from app.api import deps
from app.api.endpoints import auth as auth_endpoints
from app.core import security
from app.core.config import Settings
from fastapi import HTTPException
from jose import jwt
from sqlalchemy.exc import OperationalError


class DummyDB:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0
        self.added = []

    def add(self, obj) -> None:
        self.added.append(obj)

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def execute(self, _stmt) -> None:
        return None


def test_decode_refresh_token_accepts_refresh_tokens():
    token = security.create_refresh_token("user-123")
    payload = security.decode_refresh_token(token)

    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["type"] == "refresh"


def test_coerce_utc_datetime_makes_naive_values_safe():
    naive = datetime(2026, 3, 26, 9, 30, 0)
    aware = deps._coerce_utc_datetime(naive)

    assert aware is not None
    assert aware.tzinfo is not None
    assert aware.utcoffset() == timezone.utc.utcoffset(aware)


def test_touch_user_auth_activity_handles_naive_last_active_timestamp():
    db = DummyDB()
    user = SimpleNamespace(
        id=uuid4(),
        last_active_at=datetime(2026, 3, 26, 9, 0, 0),
    )
    now = datetime(2026, 3, 26, 9, 20, 0, tzinfo=timezone.utc)
    user_key = str(user.id)

    deps._last_active_flush.pop(user_key, None)
    deps._last_daily_activity_mark[user_key] = now.date()

    deps.touch_user_auth_activity(db, user, now=now)

    assert user.last_active_at.tzinfo is not None
    assert user.last_active_at.utcoffset() == timezone.utc.utcoffset(user.last_active_at)
    assert db.commits == 1

    deps._last_active_flush.pop(user_key, None)
    deps._last_daily_activity_mark.pop(user_key, None)


def test_verify_supabase_access_token_builds_identity_and_caches(monkeypatch):
    class Response:
        status_code = 200

        @staticmethod
        def json():
            return {
                "id": "supabase-user-1",
                "email": "User@Example.com",
                "email_confirmed_at": "2026-03-01T10:00:00Z",
                "user_metadata": {"full_name": "Test User"},
                "app_metadata": {"provider": "google"},
            }

    calls = {"count": 0}

    def fake_get(*_args, **_kwargs):
        calls["count"] += 1
        return Response()

    class FakeSession:
        @staticmethod
        def get(*args, **kwargs):
            return fake_get(*args, **kwargs)

    monkeypatch.setattr(deps.settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(deps.settings, "SUPABASE_KEY", "anon-key")
    monkeypatch.setattr(deps, "_get_supabase_http_session", lambda: FakeSession())
    deps._external_token_identity_cache.clear()

    identity_first = deps._verify_supabase_access_token("token-123")
    identity_second = deps._verify_supabase_access_token("token-123")

    assert identity_first == identity_second
    assert identity_first["sub"] == "supabase-user-1"
    assert identity_first["email"] == "user@example.com"
    assert identity_first["provider"] == "google"
    assert calls["count"] == 1


def test_verify_supabase_access_token_rejects_unconfirmed_email(monkeypatch):
    class Response:
        status_code = 200

        @staticmethod
        def json():
            return {
                "id": "supabase-unconfirmed",
                "email": "unconfirmed@example.com",
                "user_metadata": {},
                "app_metadata": {"provider": "email"},
            }

    class FakeSession:
        @staticmethod
        def get(*_args, **_kwargs):
            return Response()

    monkeypatch.setattr(deps.settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(deps.settings, "SUPABASE_KEY", "anon-key")
    monkeypatch.setattr(deps, "_get_supabase_http_session", lambda: FakeSession())
    deps._external_token_identity_cache.clear()

    assert deps._verify_supabase_access_token("token-unconfirmed") is None


def test_expired_access_token_is_rejected():
    token = security.create_access_token(
        "user-123", expires_delta=timedelta(seconds=-5)
    )

    assert security.decode_access_token(token) is None


def test_access_and_refresh_tokens_are_not_interchangeable():
    access_token = security.create_access_token("user-123")
    refresh_token = security.create_refresh_token("user-123")

    assert security.decode_access_token(access_token) is not None
    assert security.decode_refresh_token(refresh_token) is not None
    assert security.decode_access_token(refresh_token) is None
    assert security.decode_refresh_token(access_token) is None


def test_tokens_without_explicit_type_or_required_claims_are_rejected():
    now = datetime.now(timezone.utc)
    untyped = jwt.encode(
        {"sub": "user-123", "iat": now, "exp": now + timedelta(minutes=5)},
        security._signing_key(),
        algorithm=security.ALGORITHM,
    )
    no_expiry = jwt.encode(
        {"sub": "user-123", "iat": now, "type": "access"},
        security._signing_key(),
        algorithm=security.ALGORITHM,
    )

    assert security.decode_access_token(untyped) is None
    assert security.decode_access_token(no_expiry) is None
    assert security.decode_access_token("not-a-jwt") is None


def _production_settings(**overrides) -> Settings:
    values = {
        "_env_file": None,
        "APP_ENV": "production",
        "SECRET_KEY": "S" * 48,
        "DATABASE_URL": (
            "postgresql://app_user:strong-password@db.example.com:5432/postgres"
        ),
        "PAYMENTS_DEMO_MODE": False,
        "GOOGLE_CLIENT_ID": "1234567890.apps.googleusercontent.com",
        "SUPABASE_URL": "https://example-project.supabase.co",
        "SUPABASE_KEY": "anon-key-for-tests",
        "MONGODB_URI": (
            "mongodb+srv://app_user:strong-password@cluster.example.net/db"
        ),
        "CORS_ORIGINS": "https://app.example.com",
    }
    values.update(overrides)
    return Settings(**values)


def test_production_configuration_control_case_is_valid():
    assert _production_settings().validate_production_safety() is None


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"SECRET_KEY": "short"}, "SECRET_KEY"),
        (
            {"SECRET_KEY": "your-secret-key-that-is-long-enough-to-pass-length"},
            "SECRET_KEY",
        ),
        (
            {"SECRET_KEY": "<paste-a-random-64-character-secret-here>"},
            "SECRET_KEY",
        ),
        (
            {"SECRET_KEY": "replace-me-with-a-random-64-character-secret"},
            "SECRET_KEY",
        ),
        ({"DATABASE_URL": "sqlite:///./sql_app.db"}, "PostgreSQL"),
        ({"PAYMENTS_DEMO_MODE": True}, "PAYMENTS_DEMO_MODE"),
        ({"GOOGLE_CLIENT_ID": ""}, "GOOGLE_CLIENT_ID"),
        ({"SUPABASE_KEY": "sb_secret_example_value"}, "service-role"),
        ({"CORS_ORIGINS": "*"}, "CORS_ORIGINS"),
        ({"RATE_LIMIT_ENABLED": False}, "RATE_LIMIT_ENABLED"),
        ({"AUTH_RATE_LIMIT_PER_MINUTE": 0}, "AUTH_RATE_LIMIT_PER_MINUTE"),
        ({"MAX_REQUEST_BODY_BYTES": 0}, "MAX_REQUEST_BODY_BYTES"),
    ],
)
def test_production_rejects_insecure_configuration(overrides, message):
    with pytest.raises(RuntimeError, match=message):
        _production_settings(**overrides).validate_production_safety()


def test_google_login_requires_a_client_id_in_production(monkeypatch):
    monkeypatch.setattr(auth_endpoints.settings, "APP_ENV", "production")
    monkeypatch.setattr(auth_endpoints.settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(
        auth_endpoints.id_token,
        "verify_oauth2_token",
        lambda *_args, **_kwargs: pytest.fail("must not verify without a client id"),
    )

    with pytest.raises(HTTPException) as exc:
        auth_endpoints.google_login(
            auth_endpoints.GoogleToken(token="x" * 20),
            DummyDB(),
        )

    assert exc.value.status_code == 503


def test_google_login_passes_the_configured_audience_to_verification(monkeypatch):
    captured = {}

    def fake_verify(_token, _request, audience=None):
        captured["audience"] = audience
        raise ValueError("signature verification failed")

    monkeypatch.setattr(auth_endpoints.settings, "APP_ENV", "development")
    monkeypatch.setattr(
        auth_endpoints.settings, "GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com"
    )
    monkeypatch.setattr(auth_endpoints.id_token, "verify_oauth2_token", fake_verify)

    with pytest.raises(HTTPException) as exc:
        auth_endpoints.google_login(auth_endpoints.GoogleToken(token="x" * 20), DummyDB())

    assert captured["audience"] == "client-id.apps.googleusercontent.com"
    assert exc.value.status_code == 400


def test_google_login_rejects_unverified_google_email(monkeypatch):
    monkeypatch.setattr(auth_endpoints.settings, "APP_ENV", "development")
    monkeypatch.setattr(auth_endpoints.settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(
        auth_endpoints.id_token,
        "verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "email": "attacker@example.com",
            "email_verified": False,
        },
    )

    with pytest.raises(HTTPException) as exc:
        auth_endpoints.google_login(auth_endpoints.GoogleToken(token="x" * 20), DummyDB())

    assert exc.value.status_code == 403


def test_google_login_does_not_auto_link_an_existing_password_account(monkeypatch):
    monkeypatch.setattr(auth_endpoints.settings, "APP_ENV", "development")
    monkeypatch.setattr(auth_endpoints.settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(
        auth_endpoints.id_token,
        "verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "email": "existing@example.com",
            "email_verified": True,
        },
    )
    monkeypatch.setattr(
        auth_endpoints.crud,
        "get_user_by_email",
        lambda *_args, **_kwargs: SimpleNamespace(
            id=uuid4(),
            email="existing@example.com",
            login_type="custom",
            is_verified=True,
        ),
    )

    with pytest.raises(HTTPException) as exc:
        auth_endpoints.google_login(auth_endpoints.GoogleToken(token="x" * 20), DummyDB())

    assert exc.value.status_code == 409


def test_current_user_database_failure_is_safe_503_not_auth_failure():
    """A connection/query failure must not be misreported as invalid credentials."""
    class BrokenDatabase:
        def query(self, *_args, **_kwargs):
            raise OperationalError("SELECT", {}, RuntimeError("database unavailable"))

    token = security.create_access_token(str(uuid4()))

    try:
        deps.get_current_user(db=BrokenDatabase(), token=token)
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "Authentication service temporarily unavailable"
    else:
        raise AssertionError("Expected database outage to return a dependency failure")
