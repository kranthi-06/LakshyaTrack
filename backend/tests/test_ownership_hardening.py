"""Authorization, IDOR, and route-protection regression tests."""
import asyncio
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import deps
from app.api.endpoints import quiz as quiz_endpoint
from app.api.endpoints import roadmap as roadmap_endpoint
from app.api.endpoints import saved_resumes as saved_resumes_endpoint
from app.api.endpoints import users as users_endpoint
from app.db.base_class import Base
from app.main import app
from app.models.career import Roadmap
from app.models.resume import SavedResume


@compiles(UUID, "sqlite")
def _compile_uuid_for_sqlite(_type, _compiler, **_kwargs):
    return "CHAR(36)"


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine, tables=[SavedResume.__table__, Roadmap.__table__]
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _user(external_id=None, role="user", **overrides):
    values = {
        "id": external_id or uuid.uuid4(),
        "email": "user@example.test",
        "role": role,
        "is_active": True,
        "is_verified": True,
        "is_blacklisted": False,
        "last_active_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_saved_resume_reads_and_writes_are_scoped_to_the_owner(db):
    owner = _user()
    attacker = _user()
    resume = SavedResume(
        user_id=owner.id,
        resume_name="Owner resume",
        resume_data={"summary": "private"},
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    listed = asyncio.run(
        saved_resumes_endpoint.get_saved_resumes(db=db, current_user=attacker)
    )
    assert listed == {"resumes": []}

    with pytest.raises(HTTPException) as update_error:
        asyncio.run(
            saved_resumes_endpoint.update_saved_resume(
                str(resume.id),
                saved_resumes_endpoint.ResumeUpdateRequest(resume_name="stolen"),
                db=db,
                current_user=attacker,
            )
        )
    assert update_error.value.status_code == 404

    with pytest.raises(HTTPException) as delete_error:
        asyncio.run(
            saved_resumes_endpoint.delete_saved_resume(
                str(resume.id), db=db, current_user=attacker
            )
        )
    assert delete_error.value.status_code == 404

    db.expire_all()
    persisted = db.query(SavedResume).filter_by(id=resume.id).one()
    assert persisted.resume_name == "Owner resume"
    assert persisted.user_id == owner.id


def test_roadmap_reads_and_writes_are_scoped_to_the_owner(db):
    owner = _user()
    attacker = _user()
    roadmap = Roadmap(
        user_id=owner.id,
        target_role="Backend Engineer",
        roadmap_data={"levels": []},
        generation_status="completed",
        is_active=True,
    )
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)

    with pytest.raises(HTTPException) as status_error:
        asyncio.run(
            roadmap_endpoint.get_roadmap_status(
                str(roadmap.id), db=db, current_user=attacker
            )
        )
    assert status_error.value.status_code == 404

    with pytest.raises(HTTPException) as delete_error:
        asyncio.run(
            roadmap_endpoint.delete_roadmap(
                roadmap_endpoint.DeleteRoadmapRequest(roadmap_id=str(roadmap.id)),
                db=db,
                current_user=attacker,
            )
        )
    assert delete_error.value.status_code == 404

    with pytest.raises(HTTPException) as skill_error:
        asyncio.run(
            roadmap_endpoint.update_skill(
                roadmap_endpoint.SkillUpdateRequest(
                    roadmap_id=str(roadmap.id),
                    skill_id="skill-1",
                    status="completed",
                ),
                db=db,
                current_user=attacker,
            )
        )
    assert skill_error.value.status_code == 400

    db.expire_all()
    assert db.query(Roadmap).filter_by(id=roadmap.id).count() == 1


def test_profile_update_schema_cannot_set_privileged_fields():
    fields = set(users_endpoint.ProfileUpdateRequest.model_fields)

    assert "role" not in fields
    assert "is_superuser" not in fields
    assert "is_blacklisted" not in fields
    assert "is_active" not in fields


def test_inactive_and_unverified_users_are_denied():
    with pytest.raises(HTTPException) as inactive:
        deps.get_current_active_user(
            current_user=_user(is_active=False, is_verified=True)
        )
    assert inactive.value.status_code == 400

    with pytest.raises(HTTPException) as unverified:
        deps.get_current_active_user(
            current_user=_user(is_active=True, is_verified=False)
        )
    assert unverified.value.status_code == 403


def test_blacklisted_user_is_denied_even_with_a_valid_token(monkeypatch):
    blocked = _user(is_blacklisted=True)
    monkeypatch.setattr(deps.settings, "BLACK_ADMIN_EMAILS", "")
    monkeypatch.setattr(
        deps,
        "_resolve_token_identity",
        lambda _token: {"sub": str(blocked.id), "identity_source": "internal"},
    )
    monkeypatch.setattr(deps.crud_user, "get_user", lambda _db, _id: blocked)

    with pytest.raises(HTTPException) as denied:
        deps.get_current_user(db=object(), token="valid-token")

    assert denied.value.status_code == 403
    assert "blocked" in denied.value.detail


def test_regular_user_cannot_satisfy_admin_dependencies():
    regular = _user(role="user")
    admin = _user(role="admin")

    with pytest.raises(HTTPException) as regular_error:
        deps.require_admin(current_user=regular)
    assert regular_error.value.status_code == 403

    with pytest.raises(HTTPException) as black_admin_error:
        deps.require_black_admin(current_user=admin)
    assert black_admin_error.value.status_code == 403


def test_configured_black_admin_email_gets_admin_access(monkeypatch):
    monkeypatch.setattr(deps.settings, "BLACK_ADMIN_EMAILS", "root@example.test")
    user = _user(role="user", email="root@example.test")

    assert deps._resolve_user_role(user) == "black_admin"
    assert deps.require_admin(current_user=user) is user


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/v1/quiz/generate"),
        ("post", "/api/v1/english/analyze-speaking"),
        ("post", "/api/v1/reasoning/submit-test"),
        ("post", "/api/v1/opportunities/cleanup"),
        ("post", "/api/v1/opportunities/fetch-external"),
        ("post", "/api/v1/subscription/checkout"),
        ("post", "/api/v1/media/upload"),
    ],
)
def test_sensitive_routes_require_authentication(method, path):
    response = getattr(TestClient(app), method)(path, json={})

    assert response.status_code == 401


def test_regular_user_cannot_call_admin_opportunity_endpoints():
    user = _user(role="user")
    app.dependency_overrides[deps.get_current_active_user] = lambda: user
    try:
        client = TestClient(app)
        cleanup = client.post("/api/v1/opportunities/cleanup", json={})
        fetch_external = client.post(
            "/api/v1/opportunities/fetch-external", json={}
        )
    finally:
        app.dependency_overrides.clear()

    assert cleanup.status_code == 403
    assert fetch_external.status_code == 403


def test_quiz_endpoint_rejects_unbounded_generation_requests():
    with pytest.raises(ValidationError):
        quiz_endpoint.QuizRequest(topic="Python", count=10_000)
    with pytest.raises(ValidationError):
        quiz_endpoint.QuizRequest(topic="", count=1)
