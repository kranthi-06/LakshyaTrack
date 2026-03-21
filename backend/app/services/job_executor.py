"""
Centralized async job execution handlers.
"""
from typing import Any, Dict

from app.db.session import SessionLocal
from app.services import opportunity_service
from app.services.reasoning_service import generate_questions_ai
from app.core.response_cache import cache_delete_prefix


async def execute_job(job_type: str, payload: Dict[str, Any]) -> Any:
    payload = payload or {}

    if job_type == "opportunities.discover":
        db = SessionLocal()
        try:
            opportunities = await opportunity_service.generate_opportunities(
                target_role=payload.get("target_role", ""),
                skills=payload.get("skills", []) or [],
                level=payload.get("level", "Beginner"),
                db=db,
            )
        finally:
            db.close()
        await cache_delete_prefix("resp:opps:")
        return {"opportunities": opportunities, "count": len(opportunities)}

    if job_type == "opportunities.recommend":
        db = SessionLocal()
        try:
            recommendations = await opportunity_service.get_ai_recommendations(
                user_skills=payload.get("skills", []) or [],
                user_role=payload.get("target_role", "Software Engineer"),
                db=db,
                limit=int(payload.get("limit", 12)),
            )
        finally:
            db.close()
        return {"opportunities": recommendations, "count": len(recommendations)}

    if job_type == "opportunities.fetch_external":
        db = SessionLocal()
        try:
            rss_count = await opportunity_service.fetch_rss_opportunities(db)
            api_count = await opportunity_service.fetch_public_api_opportunities(db)
        finally:
            db.close()
        await cache_delete_prefix("resp:opps:")
        return {
            "rss_fetched": rss_count,
            "api_fetched": api_count,
            "total_new": rss_count + api_count,
        }

    if job_type == "reasoning.generate":
        topic = payload.get("topic", "")
        difficulty = payload.get("difficulty", "medium")
        count = int(payload.get("count", 10))
        company = payload.get("company", "")
        questions = await generate_questions_ai(
            topic=topic,
            difficulty=difficulty,
            count=count,
            company=company,
        )
        for i, q in enumerate(questions):
            if "id" not in q:
                q["id"] = f"ai-{topic}-{i}-{hash(q.get('question', '')) % 100000}"
        return {
            "questions": questions,
            "count": len(questions),
            "topic": topic,
            "difficulty": difficulty,
        }

    raise ValueError(f"Unsupported job type: {job_type}")
