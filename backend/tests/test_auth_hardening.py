from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api import deps
from app.core import security


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
