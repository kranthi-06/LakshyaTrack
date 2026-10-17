import asyncio

import pytest
from fastapi import HTTPException

from app.api.endpoints import english_speaking
from app.core.config import settings
from app.services import ai_service as ai_service_module
from app.services import learning_service, resume_service


def test_ai_completion_fails_closed_without_available_providers(monkeypatch):
    hub = ai_service_module.AIService()
    hub.groq_available = False
    hub.gemini_configured = False
    hub.openai_client = None
    monkeypatch.setattr(
        ai_service_module.document_store_service,
        "get_ai_cache",
        lambda *_args, **_kwargs: None,
    )

    with pytest.raises(RuntimeError, match="temporarily unavailable"):
        asyncio.run(
            hub.chat_completion(
                [{"role": "user", "content": "Generate interview questions"}],
                "You are an interview coach.",
            )
        )


def test_speaking_analysis_fails_closed(monkeypatch):
    async def fail(*_args, **_kwargs):
        raise RuntimeError("all providers unavailable")

    monkeypatch.setattr(english_speaking.ai_hub, "chat_completion", fail)
    request = english_speaking.SpeakingAnalysisRequest(
        type="sentence",
        original_text="hello world",
        user_text="hello",
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(english_speaking.analyze_speaking(request))

    assert exc_info.value.status_code == 503


def test_resume_analysis_failure_is_not_cached_or_leaked(monkeypatch):
    async def fail(*_args, **_kwargs):
        raise RuntimeError("provider-internal-detail")

    cached_calls = []
    monkeypatch.setattr(resume_service.ai_hub, "chat_completion", fail)
    monkeypatch.setattr(
        resume_service.document_store_service,
        "get_ai_cache",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        resume_service.document_store_service,
        "set_ai_cache",
        lambda **kwargs: cached_calls.append(kwargs),
    )

    result = asyncio.run(resume_service.analyze_resume_with_ai("Python developer resume"))

    assert result["ats_score"] == 0
    assert cached_calls == []
    assert "provider-internal-detail" not in str(result)


def test_learning_resources_return_empty_without_youtube_key(monkeypatch):
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "")

    videos = asyncio.run(learning_service.search_youtube_videos("python"))

    assert videos == []


def test_learning_resources_only_forward_real_api_videos(monkeypatch):
    async def fake_fetch(query: str, max_results: int = 5):
        assert query == "python"
        assert max_results == 2
        return [
            {
                "videoId": "real-video-id",
                "title": "Real video",
                "channel": "Real channel",
                "thumbnail": "https://example.com/thumb.jpg",
                "url": "https://www.youtube.com/watch?v=real-video-id",
            }
        ]

    monkeypatch.setattr(learning_service, "fetch_youtube_videos", fake_fetch)

    videos = asyncio.run(learning_service.search_youtube_videos("python", 2))

    assert videos == [
        {
            "videoId": "real-video-id",
            "title": "Real video",
            "channel": "Real channel",
            "thumbnail": "https://example.com/thumb.jpg",
            "url": "https://www.youtube.com/watch?v=real-video-id",
            "id": "real-video-id",
        }
    ]
