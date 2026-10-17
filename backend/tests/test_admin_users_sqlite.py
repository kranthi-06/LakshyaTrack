import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import deps
from app.db.base_class import Base
from app.main import app
from app.models.career import ProgressSnapshot, Roadmap
from app.models.user import Profile, User


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@compiles(UUID, "sqlite")
def _compile_uuid_for_sqlite(_type, _compiler, **_kwargs):
    return "CHAR(36)"


@pytest.fixture
def admin_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    tables = [User.__table__, Profile.__table__, Roadmap.__table__, ProgressSnapshot.__table__]
    Base.metadata.create_all(engine, tables=tables)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    def override_db():
        yield session

    def override_admin():
        return User(id=1, email="admin@example.test", role="admin")

    app.dependency_overrides[deps.get_db] = override_db
    app.dependency_overrides[deps.require_admin] = override_admin
    client = TestClient(app)
    try:
        yield client, session, engine
    finally:
        app.dependency_overrides.pop(deps.get_db, None)
        app.dependency_overrides.pop(deps.require_admin, None)
        session.close()
        engine.dispose()


def test_admin_user_list_paginates_searches_and_omits_password_hash(admin_client):
    client, db, _engine = admin_client
    # Use Integer IDs for SQLite compatibility
    first = User(id=1, email="first@example.test", hashed_password="secret-hash", role="user")
    second = User(id=2, email="second@example.test", hashed_password="secret-hash", role="user")
    third = User(id=3, email="third@example.test", hashed_password="secret-hash", role="user")
    first.profile = Profile(id=first.id, full_name="Ada Lovelace")
    second.profile = Profile(id=second.id, full_name="Grace Hopper")
    db.add_all([first, second, third])
    db.commit()

    response = client.get("/api/v1/admin/users?skip=1&limit=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert payload["skip"] == 1
    assert payload["limit"] == 1
    assert len(payload["users"]) == 1
    assert all("hashed_password" not in row for row in payload["users"])

    name_search = client.get("/api/v1/admin/users?search=Grace")
    assert name_search.status_code == 200
    assert [row["email"] for row in name_search.json()["users"]] == ["second@example.test"]

    assert client.get("/api/v1/admin/users?limit=201").status_code == 422


def test_admin_user_list_requires_admin_role():
    def deny_admin():
        raise HTTPException(status_code=403, detail="admin access required")

    app.dependency_overrides[deps.require_admin] = deny_admin
    try:
        response = TestClient(app).get("/api/v1/admin/users")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(deps.require_admin, None)


def test_admin_user_list_rejects_unauthenticated_request():
    response = TestClient(app).get("/api/v1/admin/users")
    assert response.status_code == 401


def test_detailed_health_rejects_normal_user():
    user = User(id=1, email="user@example.test", role="user")
    app.dependency_overrides[deps.get_current_active_user] = lambda: user
    try:
        response = TestClient(app).get("/health/detailed")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(deps.get_current_active_user, None)
