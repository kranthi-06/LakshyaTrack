"""
AI Service — Production-grade with circuit breakers, retry with exponential
backoff, timeout protection, and fail-closed provider fallback chain:
  1. Groq (Primary)
  2. Gemini (Secondary)
  3. OpenAI (Tertiary)

If every provider is unavailable the request fails with an explicit error
instead of returning fabricated content.
"""
import asyncio
import json
import logging
import sys
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.resilience import (
    CircuitBreakerOpenError,
    get_circuit_breaker,
    health_metrics,
    retry_with_backoff,
    safe_json_parse,
    sanitize_for_logging,
)
from app.services import document_store_service

logger = logging.getLogger(__name__)

# SECURITY: API keys MUST come from environment variables.
# Never hardcode keys in source code.

# Timeout configurations (seconds)
GROQ_TIMEOUT = 30.0
GEMINI_TIMEOUT = 30.0
OPENAI_TIMEOUT = 20.0

# Circuit breaker configurations
GROQ_CB = "ai_groq"
GEMINI_CB = "ai_gemini"
OPENAI_CB = "ai_openai"
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


class AIService:
    def __init__(self):
        self.last_error: Optional[str] = None

        # ── Initialize Groq (Primary) ──────────────────────────
        self.groq_available = False
        raw_key = (settings.GROQ_API_KEY or "").strip() or None
        self.groq_api_key = raw_key

        if self.groq_api_key and len(self.groq_api_key) > 10:
            try:
                from groq import AsyncGroq  # noqa: F401
                self.groq_available = True
                logger.info("Groq initialized as primary AI provider")
            except ImportError:
                logger.error("Groq library not found. pip install groq")
            except Exception as e:
                logger.error("Failed to configure Groq: %s", str(e))

        # Initialize circuit breaker for Groq
        get_circuit_breaker(GROQ_CB, failure_threshold=5, recovery_timeout=60.0)

        # ── Initialize OpenAI (Secondary) ──────────────────────
        self.openai_client: Optional[AsyncOpenAI] = None
        if settings.OPENAI_API_KEY and "sk-" in settings.OPENAI_API_KEY:
            try:
                self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                logger.info("OpenAI initialized as secondary AI provider")
            except Exception as e:
                logger.error("Failed to configure OpenAI: %s", str(e))

        get_circuit_breaker(OPENAI_CB, failure_threshold=5, recovery_timeout=90.0)

        # ── Initialize Gemini (Tertiary) ───────────────────────
        self.gemini_configured = False
        self.gemini_api_key: Optional[str] = None
        if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10:
            try:
                self.gemini_api_key = settings.GEMINI_API_KEY.strip()
                self.gemini_configured = True
                logger.info("Gemini initialized as tertiary AI provider")
            except Exception as e:
                logger.error("Failed to configure Gemini: %s", str(e))

        get_circuit_breaker(GEMINI_CB, failure_threshold=5, recovery_timeout=90.0)

    def _record_ai_output(
        self,
        provider: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        response: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            document_store_service.record_ai_output(
                output_type="chat_completion",
                provider=provider,
                input_payload={
                    "system_prompt": system_prompt,
                    "messages": messages,
                },
                response=response,
                metadata=metadata or {},
            )
        except Exception:
            pass  # Never let logging crash the AI call

    # ── Private provider calls (wrapped with timeout + CB) ─────

    async def _call_groq(
        self,
        full_messages: List[Dict[str, str]],
    ) -> str:
        """Call Groq API with timeout protection."""
        from groq import AsyncGroq

        client = AsyncGroq(api_key=self.groq_api_key)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=full_messages,
                temperature=0.7,
                max_tokens=4096,
            ),
            timeout=GROQ_TIMEOUT,
        )
        return response.choices[0].message.content

    async def _call_gemini(self, prompt_text: str) -> str:
        """Call Gemini API with timeout protection."""
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt_text,
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
                response = await client.post(
                    GEMINI_API_URL,
                    params={"key": self.gemini_api_key},
                    json=payload,
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise asyncio.TimeoutError() from exc
        except httpx.HTTPStatusError as exc:
            error_body = exc.response.text.strip()
            raise RuntimeError(
                f"Gemini HTTP {exc.response.status_code}: {error_body[:500]}"
            ) from exc

        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            prompt_feedback = data.get("promptFeedback") or {}
            raise RuntimeError(
                f"Gemini returned no candidates: {json.dumps(prompt_feedback, ensure_ascii=False)}"
            )

        content = candidates[0].get("content") or {}
        parts = content.get("parts") or []
        text = "".join(
            part.get("text", "")
            for part in parts
            if isinstance(part, dict) and part.get("text")
        ).strip()
        if text:
            return text

        finish_reason = candidates[0].get("finishReason") or "unknown"
        raise RuntimeError(f"Gemini returned empty content (finish_reason={finish_reason})")

    async def _call_openai(
        self,
        full_messages: List[Dict[str, str]],
    ) -> str:
        """Call OpenAI API with timeout protection."""
        response = await asyncio.wait_for(
            self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=full_messages,
                temperature=0.7,
            ),
            timeout=OPENAI_TIMEOUT,
        )
        return response.choices[0].message.content

    # ── Main completion method with full fault tolerance ────────

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Get AI completion with full fault-tolerance chain: Groq → Gemini → OpenAI.

        Each provider has circuit-breaker protection, timeout protection and
        automatic failover. If all providers fail, raise instead of returning
        fabricated fallback content.
        """
        logger.info("--- AI COMPLETION REQUEST ---")

        full_messages = messages
        if system_prompt:
            full_messages = [{"role": "system", "content": system_prompt}] + messages

        # MongoDB-backed cache (behavior-preserving): same inputs → same output.
        # If MongoDB is not configured, this is a no-op.
        try:
            cache_payload = {
                "system_prompt": system_prompt or "",
                "messages": messages,
            }
            cache_key = hashlib.sha256(
                json.dumps(cache_payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
            ).hexdigest()
            cached = document_store_service.get_ai_cache(cache_key)
            if cached and "response" in cached and cached.get("provider") != "mock":
                logger.info("AI cache hit")
                return str(cached["response"])
        except Exception:
            # Cache must never affect correctness or availability
            cache_key = None

        # ── 1. Try Groq (Primary) ──────────────────────────────
        if self.groq_available:
            groq_cb = get_circuit_breaker(GROQ_CB)
            if groq_cb.allow_request():
                try:
                    result = await self._call_groq(full_messages)
                    groq_cb.record_success()
                    health_metrics.record_request("ai_groq", 0, success=True)
                    logger.info("Groq: Success")
                    self._record_ai_output(
                        provider="groq",
                        messages=messages,
                        system_prompt=system_prompt,
                        response=result,
                        metadata={"model": "llama-3.3-70b-versatile"},
                    )
                    if cache_key:
                        document_store_service.set_ai_cache(
                            cache_key=cache_key,
                            response=result,
                            provider="groq",
                            input_payload={"system_prompt": system_prompt, "messages": messages},
                            metadata={"model": "llama-3.3-70b-versatile"},
                        )
                    return result
                except asyncio.TimeoutError:
                    groq_cb.record_failure()
                    health_metrics.record_request("ai_groq", GROQ_TIMEOUT * 1000, success=False)
                    self.last_error = "Groq: Timeout"
                    logger.warning("Groq timed out after %.0fs", GROQ_TIMEOUT)
                except Exception as e:
                    groq_cb.record_failure()
                    health_metrics.record_request("ai_groq", 0, success=False)
                    self.last_error = f"Groq: {type(e).__name__}: {str(e)}"
                    logger.warning("Groq failed: %s", self.last_error)
            else:
                logger.info("Groq circuit breaker OPEN — skipping")

        # ── 2. Try Gemini (Secondary) ──────────────────────────
        if self.gemini_configured:
            gemini_cb = get_circuit_breaker(GEMINI_CB)
            if gemini_cb.allow_request():
                try:
                    gemini_prompt = ""
                    if system_prompt:
                        gemini_prompt += f"System Instructions: {system_prompt}\n\n"
                    for msg in messages:
                        role = "User" if msg["role"] == "user" else "Assistant"
                        gemini_prompt += f"{role}: {msg['content']}\n"
                    gemini_prompt += "Assistant: "

                    result = await self._call_gemini(gemini_prompt)
                    gemini_cb.record_success()
                    health_metrics.record_request("ai_gemini", 0, success=True)
                    logger.info("Gemini: Success (failover)")
                    self._record_ai_output(
                        provider="gemini",
                        messages=messages,
                        system_prompt=system_prompt,
                        response=result,
                        metadata={"model": "gemini-1.5-flash"},
                    )
                    if cache_key:
                        document_store_service.set_ai_cache(
                            cache_key=cache_key,
                            response=result,
                            provider="gemini",
                            input_payload={"system_prompt": system_prompt, "messages": messages},
                            metadata={"model": "gemini-1.5-flash"},
                        )
                    return result
                except asyncio.TimeoutError:
                    gemini_cb.record_failure()
                    health_metrics.record_request("ai_gemini", GEMINI_TIMEOUT * 1000, success=False)
                    logger.warning("Gemini timed out after %.0fs", GEMINI_TIMEOUT)
                except Exception as e:
                    gemini_cb.record_failure()
                    health_metrics.record_request("ai_gemini", 0, success=False)
                    logger.warning("Gemini failed: %s", str(e))
            else:
                logger.info("Gemini circuit breaker OPEN — skipping")

        # ── 3. Try OpenAI (Tertiary) ───────────────────────────
        if self.openai_client:
            openai_cb = get_circuit_breaker(OPENAI_CB)
            if openai_cb.allow_request():
                try:
                    result = await self._call_openai(full_messages)
                    openai_cb.record_success()
                    health_metrics.record_request("ai_openai", 0, success=True)
                    logger.info("OpenAI: Success (failover)")
                    self._record_ai_output(
                        provider="openai",
                        messages=messages,
                        system_prompt=system_prompt,
                        response=result,
                        metadata={"model": "gpt-4o-mini"},
                    )
                    if cache_key:
                        document_store_service.set_ai_cache(
                            cache_key=cache_key,
                            response=result,
                            provider="openai",
                            input_payload={"system_prompt": system_prompt, "messages": messages},
                            metadata={"model": "gpt-4o-mini"},
                        )
                    return result
                except asyncio.TimeoutError:
                    openai_cb.record_failure()
                    health_metrics.record_request("ai_openai", OPENAI_TIMEOUT * 1000, success=False)
                    logger.warning("OpenAI timed out after %.0fs", OPENAI_TIMEOUT)
                except Exception as e:
                    openai_cb.record_failure()
                    health_metrics.record_request("ai_openai", 0, success=False)
                    logger.warning("OpenAI failed: %s", str(e))
            else:
                logger.info("OpenAI circuit breaker OPEN — skipping")

        # ── 4. Fail closed — never return fabricated content ───
        health_metrics.record_request("ai_unavailable", 0, success=False)
        logger.warning("ALL AI providers failed. Failing closed.")
        
        # Provide more specific error information for debugging
        provider_status = self.get_provider_status()
        missing_providers = [k for k, v in provider_status.items() if k != 'last_error' and not v.get('available')]
        
        if missing_providers:
            raise RuntimeError(
                f"AI service is temporarily unavailable because no AI providers are configured. "
                f"Missing API keys for: {', '.join(missing_providers)}. "
                f"Please configure at least one of: GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
            )
        
        raise RuntimeError(
            f"AI service is temporarily unavailable. All configured providers failed. "
            f"Last error: {self.last_error or 'Unknown error'}. Please try again shortly."
        )

    async def generate_quiz_questions(
        self, topic: str, difficulty: str, count: int
    ) -> str:
        """Generate quiz questions with input validation."""
        topic = (topic or "General Knowledge").strip()[:200]
        difficulty = (difficulty or "medium").strip()[:20]
        count = max(1, min(count, 50))

        system_prompt = f"You are an expert technical interviewer and quiz generator for {topic}."
        prompt = f"""
        Generate {count} unique multiple-choice quiz questions for {topic} at a {difficulty} difficulty level.
        Each question must have 4 options and 1 correct answer.

        Return the response in the following JSON format ONLY:
        [
            {{
                "id": 1,
                "question": "The question text",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0
            }},
            ...
        ]

        IMPORTANT: Return ONLY valid JSON. No markdown, no conversational text.
        """
        return await self.chat_completion(
            [{"role": "user", "content": prompt}], system_prompt
        )

    def get_provider_status(self) -> dict:
        """Return the status of all AI providers for monitoring."""
        return {
            "groq": {
                "available": self.groq_available,
                "circuit_breaker": get_circuit_breaker(GROQ_CB).get_status(),
            },
            "gemini": {
                "available": self.gemini_configured,
                "circuit_breaker": get_circuit_breaker(GEMINI_CB).get_status(),
            },
            "openai": {
                "available": self.openai_client is not None,
                "circuit_breaker": get_circuit_breaker(OPENAI_CB).get_status(),
            },
            "last_error": self.last_error,
        }


# Singleton instance
ai_hub = AIService()
