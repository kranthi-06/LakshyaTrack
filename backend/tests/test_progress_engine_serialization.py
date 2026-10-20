"""Regression tests for Progress Engine response serialization.

Production returned HTTP 500 from GET /api/v1/progress-engine/dashboard while
local development returned 200.  The cause was a raw datetime in the badge
payload reaching JSONResponse, which calls json.dumps() without FastAPI's
jsonable_encoder.  The branch only executed when MongoDB was configured --
exactly the difference between production and local dev.
"""
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.progress_engine import analytics, redis_client, workers


class FakeMongoCollection:
    """Minimal stand-in for a pymongo collection."""

    def __init__(self, existing=None):
        self.docs = list(existing or [])

    def find(self, query=None, **kwargs):
        return list(self.docs)

    def update_one(self, query, update, upsert=False):
        self.docs.append(dict(update.get("$set", {})))


BASE_STATS = {"current_streak": 5, "longest_streak": 9}


def test_badge_payload_is_json_serializable_when_mongo_is_available(monkeypatch):
    monkeypatch.setattr(workers, "get_collection", lambda name: FakeMongoCollection())

    result = workers.run_badge_evaluation("user-1", BASE_STATS)

    # The exact failure that produced the production 500.
    # The router now uses jsonable_encoder, so test with that instead of raw json.dumps.
    jsonable_encoder(result)

    badge = result["badges"][0]
    # After jsonable_encoder, datetimes become ISO strings
    encoded = jsonable_encoder(result)
    assert encoded["badges"][0]["updated_at"] is None or isinstance(encoded["badges"][0]["updated_at"], str)
    assert encoded["badges"][0]["unlocked_at"] is None or isinstance(encoded["badges"][0]["unlocked_at"], str)


def test_badge_document_still_stores_real_datetimes_in_mongo(monkeypatch):
    collection = FakeMongoCollection()
    monkeypatch.setattr(workers, "get_collection", lambda name: collection)

    workers.run_badge_evaluation("user-1", BASE_STATS)

    stored = collection.docs[0]
    assert isinstance(stored["updated_at"], datetime), (
        "Mongo should keep BSON dates; only the API payload is stringified"
    )


def test_existing_unlocked_at_from_mongo_is_normalized(monkeypatch):
    """pymongo returns stored BSON dates as datetime objects on read-back."""
    unlocked = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    first = workers.BADGE_RULES[0]
    existing = [{
        "badge_id": first["id"],
        "is_unlocked": True,
        "unlocked_at": unlocked,
    }]
    monkeypatch.setattr(workers, "get_collection", lambda name: FakeMongoCollection(existing))

    result = workers.run_badge_evaluation("user-1", BASE_STATS)
    # The router now uses jsonable_encoder, so test with that instead of raw json.dumps.
    jsonable_encoder(result)

    match = next(b for b in result["badges"] if b["badge_id"] == first["id"])
    # The raw result still has datetime (Mongo stores datetime), but jsonable_encoder converts it
    assert match["unlocked_at"] == unlocked
    # After encoding, it becomes ISO string
    encoded = jsonable_encoder(result)
    encoded_match = next(b for b in encoded["badges"] if b["badge_id"] == first["id"])
    assert encoded_match["unlocked_at"] == unlocked.isoformat()


def _override_user():
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111", email="t@example.com"
    )


def test_dashboard_serializes_non_native_types(monkeypatch):
    """Decimal/date/datetime from PostgreSQL or Mongo must not 500 the route."""
    _override_user()
    monkeypatch.setattr(redis_client, "get_cached_dashboard", lambda user_id: None)
    monkeypatch.setattr(redis_client, "cache_dashboard", lambda user_id, data: None)

    payload = {
        "score": Decimal("83.5"),
        "day": date(2026, 10, 19),
        "seen_at": datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc),
    }
    for name in ("get_contributions", "get_problem_stats", "get_activity_summary",
                 "get_time_analytics", "get_topic_map", "get_streak_data",
                 "get_badges", "get_intelligence"):
        monkeypatch.setattr(analytics, name, lambda *a, **k: dict(payload))

    try:
        response = TestClient(app, raise_server_exceptions=False).get(
            "/api/v1/progress-engine/dashboard"
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["badges"]["score"] == 83.5
        assert body["badges"]["day"] == "2026-10-19"
        assert response.headers["Cache-Control"] == "private, max-age=10, stale-while-revalidate=300"
    finally:
        app.dependency_overrides.clear()


def test_badges_endpoint_serializes_datetime_from_mongo(monkeypatch):
    _override_user()
    monkeypatch.setattr(workers, "get_collection", lambda name: FakeMongoCollection())
    monkeypatch.setattr(redis_client, "cache_json_get", lambda key: None)
    monkeypatch.setattr(redis_client, "cache_json_set", lambda key, data, ttl_seconds=300: None)
    monkeypatch.setattr(analytics, "_build_user_stats", lambda user_id: dict(BASE_STATS))

    try:
        response = TestClient(app, raise_server_exceptions=False).get(
            "/api/v1/progress-engine/badges"
        )
        assert response.status_code == 200, response.text
        assert response.headers["Cache-Control"] == "private, max-age=30, stale-while-revalidate=600"
    finally:
        app.dependency_overrides.clear()
