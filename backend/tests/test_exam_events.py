from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api import deps
from app.api.endpoints.exam import ExamEventPayload, ExamEventsRequest, record_events
from app.main import app
from app.models.career import ExamEvent, ExamViolation
from app.models.user import User
from app.services.exam_proctoring_service import record_violation
import pytest
from pydantic import ValidationError


class _EventQuery:
    def __init__(self, db):
        self.db = db

    def filter(self, *args):
        return self

    def first(self):
        return self.db.events[0] if self.db.events else None


class _EventDb:
    def __init__(self):
        self.events = []

    def query(self, model):
        assert model is ExamEvent
        return _EventQuery(self)

    def add(self, event):
        self.events.append(event)

    def commit(self):
        pass


class _ViolationQuery:
    def __init__(self, existing):
        self.existing = existing

    def filter(self, *args):
        return self

    def order_by(self, *args):
        return self

    def first(self):
        return self.existing

    def count(self):
        return 2


class _ViolationDb:
    def __init__(self, existing):
        self.existing = existing
        self.added = []

    def query(self, model):
        assert model is ExamViolation
        return _ViolationQuery(self.existing)

    def add(self, violation):
        self.added.append(violation)


def test_violation_is_deduplicated_without_another_penalty():
    existing = SimpleNamespace(
        id=uuid4(),
        violation_type="terminated",
        penalty_hours=1,
        locked_until=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db = _ViolationDb(existing)

    result = record_violation(
        user_id=str(uuid4()),
        violation_type="terminated",
        db=db,
    )

    assert result["duplicate"] is True
    assert result["violation_id"] == str(existing.id)
    assert result["penalty_hours"] == existing.penalty_hours
    assert db.added == []


def test_event_ingestion_is_idempotent_and_uses_authenticated_user():
    user_id = uuid4()
    db = _EventDb()
    payload = ExamEventPayload(
        client_event_id="client-event-1",
        event_type="restricted_shortcut",
        details={"combo": "Alt+G"},
        exam_topic="Python",
        exam_difficulty="Medium",
        user_id="untrusted-user",
    )
    request = ExamEventsRequest(events=[payload, payload])
    current_user = SimpleNamespace(id=user_id)

    result = record_events(
        request,
        db=db,
        current_user=current_user,
    )

    assert result == {"accepted": 1, "duplicates": 1}
    assert len(db.events) == 1
    assert db.events[0].user_id == user_id

    repeated_result = record_events(request, db=db, current_user=current_user)
    assert repeated_result == {"accepted": 0, "duplicates": 2}


def test_unknown_violation_type_is_rejected_with_422():
    user = User(id=uuid4(), email="student@example.test", role="user")
    app.dependency_overrides[deps.get_current_active_user] = lambda: user
    try:
        response = TestClient(app).post(
            "/api/v1/exam/record-violation",
            json={"violation_type": "not-allowed"},
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(deps.get_current_active_user, None)


def test_exam_events_require_authentication():
    client = TestClient(app)
    response = client.post(
        "/api/v1/exam/events",
        json={
            "events": [{
                "client_event_id": "event-1",
                "event_type": "focus_lost",
                "details": {},
                "user_id": str(uuid4()),
            }],
        },
    )
    assert response.status_code == 401


def test_event_details_limit_is_enforced_in_utf8_bytes():
    with pytest.raises(ValidationError):
        ExamEventPayload(
            client_event_id="large-details",
            event_type="focus_lost",
            details={"value": "é" * 1100},
        )
