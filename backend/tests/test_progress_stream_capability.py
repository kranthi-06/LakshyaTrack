"""Tests for the Progress Engine live-stream capability contract.

Serverless runtimes cannot hold an SSE connection open, so the backend
declines /progress-engine/stream with 501 and advertises the limitation via
/progress-engine/health.  Clients read that flag and fall back to interval
polling instead of firing a request that is guaranteed to fail.
"""
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.progress_engine.router import _streaming_supported

HEALTH_URL = "/api/v1/progress-engine/health"
STREAM_URL = "/api/v1/progress-engine/stream"


def _override_user():
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111", email="t@example.com"
    )


def test_stream_supported_when_not_serverless(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    assert _streaming_supported() is True


def test_stream_declined_on_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    assert _streaming_supported() is False


def test_health_advertises_streaming_support(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    body = TestClient(app).get(HEALTH_URL).json()
    assert body["streaming_supported"] is True

    monkeypatch.setenv("VERCEL", "1")
    body = TestClient(app).get(HEALTH_URL).json()
    assert body["streaming_supported"] is False


def test_health_flag_matches_stream_endpoint_behaviour(monkeypatch):
    """The advertised flag and the actual endpoint must never disagree."""
    monkeypatch.setenv("VERCEL", "1")
    _override_user()
    try:
        health = TestClient(app).get(HEALTH_URL).json()
        response = TestClient(app).get(STREAM_URL)

        assert health["streaming_supported"] is False
        assert response.status_code == 501
        # Truthful refusal, with no runtime internals leaked to the client.
        assert "unavailable" in response.json()["detail"].lower()
        assert "VERCEL" not in response.text
    finally:
        app.dependency_overrides.clear()
