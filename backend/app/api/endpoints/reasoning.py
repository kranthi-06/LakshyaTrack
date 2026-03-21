"""
Reasoning & Problem Solving API
Topic-wise learning, practice, tests, company questions, and AI generation.
"""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.api.deps import get_current_user_optional, require_admin
from app.models.user import User

from app.services.reasoning_service import (
    TOPICS, COMPANIES,
    get_topics, get_companies,
    get_questions_by_topic, get_questions_by_company,
    insert_questions, save_test_result, record_user_answer,
    get_user_progress,
    generate_questions_ai, extract_questions_from_text,
    _get_fallback_questions,
    on_demand_populate, count_all_questions, count_topic_questions, count_company_questions,
    start_auto_populate_job, get_auto_populate_status,
    get_reasoning_storage_backend,
    MIN_QUESTIONS_PER_TOPIC,
    MIN_QUESTIONS_PER_COMPANY,
)
from app.core.response_cache import cache_delete_prefix, cache_get_json, cache_set_json
from app.services.job_queue import get_job, submit_job

logger = logging.getLogger(__name__)
router = APIRouter()


async def _invalidate_reasoning_read_cache() -> None:
    await cache_delete_prefix("resp:reasoning:")


# ═══════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════

class GenerateQuestionsRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    count: int = Field(10, ge=1, le=60)
    company: str = ""


class SubmitTestRequest(BaseModel):
    user_id: str = "anonymous"
    test_type: str = Field(..., description="topic_test | company_test | ai_test")
    category: str
    answers: list = Field(default_factory=list)  # [{question_id, selected, correct, is_correct}]
    score: int
    total: int


class SubmitAnswerRequest(BaseModel):
    user_id: str = "anonymous"
    question_id: str
    topic: str
    is_correct: bool


class BulkInsertRequest(BaseModel):
    questions: list = Field(default_factory=list)
    topic: str = ""
    company: str = ""


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/topics")
async def list_topics():
    """List all available reasoning topics with question counts."""
    cache_key = "resp:reasoning:topics"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached
    payload = {"topics": get_topics()}
    await cache_set_json(cache_key, payload, ttl_seconds=30)
    return payload


@router.get("/companies")
async def list_companies():
    """List all companies with question counts."""
    cache_key = "resp:reasoning:companies"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached
    payload = {"companies": get_companies()}
    await cache_set_json(cache_key, payload, ttl_seconds=30)
    return payload


@router.get("/questions/topic/{topic}")
async def get_topic_questions(
    topic: str,
    difficulty: Optional[str] = None,
    limit: int = 36,
    skip: int = 0,
    mode: str = "learn",
):
    """
    Get questions for a topic.
    1. Try DB first
    2. If empty → on-demand populate (AI generate + persist)
    3. Fallback to static pool
    """
    cache_key = f"resp:reasoning:topic:{topic}:difficulty={difficulty or ''}:limit={limit}:skip={skip}:mode={mode}"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached

    db_questions = get_questions_by_topic(topic, difficulty, limit, skip)

    if not db_questions:
        # On-demand populate: generate + persist to DB
        try:
            db_questions = await on_demand_populate(topic=topic)
        except Exception:
            pass

    if not db_questions:
        db_questions = _get_fallback_questions(topic, 5)

    # Add IDs if missing
    for i, q in enumerate(db_questions):
        if "id" not in q:
            q["id"] = f"{topic}-{i}-{hash(q.get('question', '')) % 100000}"

    payload = {
        "topic": topic,
        "mode": mode,
        "questions": db_questions,
        "total": len(db_questions),
    }
    await cache_set_json(cache_key, payload, ttl_seconds=15)
    return payload


@router.get("/questions/company/{company}")
async def get_company_questions(
    company: str,
    limit: int = 30,
    skip: int = 0,
):
    """Get questions for a specific company (DB → on-demand populate → fallback)."""
    cache_key = f"resp:reasoning:company:{company}:limit={limit}:skip={skip}"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached

    db_questions = get_questions_by_company(company, limit, skip)

    if not db_questions:
        try:
            db_questions = await on_demand_populate(company=company)
        except Exception:
            pass

    if not db_questions:
        db_questions = _get_fallback_questions("coding-decoding", 5, company=company)

    for i, q in enumerate(db_questions):
        if "id" not in q:
            q["id"] = f"{company}-{i}-{hash(q.get('question', '')) % 100000}"

    payload = {
        "company": company,
        "questions": db_questions,
        "total": len(db_questions),
    }
    await cache_set_json(cache_key, payload, ttl_seconds=15)
    return payload


@router.get("/stats")
async def get_stats():
    """Get question count stats for all topics and companies."""
    topics_stats = {t["key"]: count_topic_questions(t["key"]) for t in TOPICS}
    companies_stats = {c["key"]: count_company_questions(c["key"]) for c in COMPANIES}
    return {
        "topics": topics_stats,
        "companies": companies_stats,
        "total_questions": count_all_questions(),
        "storage_backend": get_reasoning_storage_backend(),
        "targets": {
            "topic_minimum": MIN_QUESTIONS_PER_TOPIC,
            "company_minimum": MIN_QUESTIONS_PER_COMPANY,
        },
    }


@router.get("/jobs/{job_id}")
async def get_reasoning_job_status(job_id: str, _: User = Depends(require_admin)):
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/admin/populate-all")
async def admin_populate_all(_: User = Depends(require_admin)):
    """Admin: Trigger manual population of all topics and companies in the background."""
    try:
        job = start_auto_populate_job()
        await _invalidate_reasoning_read_cache()
        status = "running" if job.get("running") else job.get("status", "queued")
        return {"status": status, "job": job}
    except Exception:
        raise HTTPException(status_code=500, detail="Population failed")


@router.get("/admin/populate-status")
async def admin_populate_status(_: User = Depends(require_admin)):
    """Admin: Get current status for the manual reasoning population job."""
    return get_auto_populate_status()


@router.post("/generate")
async def generate_questions(
    request: GenerateQuestionsRequest,
    async_mode: bool = Query(False, description="If true, execute in background and return job_id"),
):
    """Generate new AI questions for a topic."""
    if async_mode:
        async def _work():
            questions = await generate_questions_ai(
                topic=request.topic,
                difficulty=request.difficulty,
                count=request.count,
                company=request.company,
            )
            for i, q in enumerate(questions):
                if "id" not in q:
                    q["id"] = f"ai-{request.topic}-{i}-{hash(q.get('question', '')) % 100000}"
            return {
                "questions": questions,
                "count": len(questions),
                "topic": request.topic,
                "difficulty": request.difficulty,
            }

        job_id = await submit_job(
            "reasoning.generate",
            factory=_work,
            payload={
                "topic": request.topic,
                "difficulty": request.difficulty,
                "count": request.count,
                "company": request.company,
            },
        )
        return JSONResponse(status_code=202, content={"job_id": job_id, "status": "queued"})

    questions = await generate_questions_ai(
        topic=request.topic,
        difficulty=request.difficulty,
        count=request.count,
        company=request.company,
    )

    for i, q in enumerate(questions):
        if "id" not in q:
            q["id"] = f"ai-{request.topic}-{i}-{hash(q.get('question', '')) % 100000}"

    return {
        "questions": questions,
        "count": len(questions),
        "topic": request.topic,
        "difficulty": request.difficulty,
    }


@router.post("/submit-test")
async def submit_test(
    request: SubmitTestRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Submit a completed test and save results."""
    test_id = save_test_result(
        user_id=str(current_user.id) if current_user else request.user_id,
        test_type=request.test_type,
        topic_or_company=request.category,
        score=request.score,
        total=request.total,
        answers=request.answers,
    )
    accuracy = round((request.score / request.total) * 100, 1) if request.total > 0 else 0

    return {
        "test_id": test_id,
        "score": request.score,
        "total": request.total,
        "accuracy": accuracy,
        "message": "Test submitted successfully",
    }


@router.post("/submit-answer")
async def submit_answer(
    request: SubmitAnswerRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Record a single answer for progress tracking."""
    record_user_answer(
        user_id=str(current_user.id) if current_user else request.user_id,
        question_id=request.question_id,
        topic=request.topic,
        is_correct=request.is_correct,
    )
    return {"status": "recorded"}


@router.get("/progress/{user_id}")
async def user_progress(user_id: str):
    """Get user's topic-wise progress and accuracy."""
    progress = get_user_progress(user_id)
    return {"user_id": user_id, "progress": progress}


@router.post("/bulk-insert")
async def bulk_insert(request: BulkInsertRequest, _: User = Depends(require_admin)):
    """Admin: Bulk insert questions into the database."""
    questions = request.questions
    for q in questions:
        if request.topic and "topic" not in q:
            q["topic"] = request.topic
        if request.company and "company" not in q:
            q["company"] = request.company

    count = insert_questions(questions)
    await _invalidate_reasoning_read_cache()
    return {"inserted": count, "message": f"Successfully inserted {count} questions"}


@router.post("/upload-extract")
async def upload_and_extract(
    file: UploadFile = File(None),
    text_content: str = Form(""),
    topic: str = Form(""),
    company: str = Form(""),
    _: User = Depends(require_admin),
):
    """
    Admin: Upload a PDF or text and extract structured questions using AI.
    """
    raw_text = text_content

    if file:
        content = await file.read()
        # For PDF extraction, try basic text extraction
        if file.filename and file.filename.lower().endswith(".pdf"):
            try:
                import io
                # Try PyPDF2 first
                try:
                    from PyPDF2 import PdfReader
                    reader = PdfReader(io.BytesIO(content))
                    raw_text = ""
                    for page in reader.pages:
                        raw_text += page.extract_text() + "\n"
                except ImportError:
                    # Fall back to treating as text
                    raw_text = content.decode("utf-8", errors="ignore")
            except Exception:
                raw_text = content.decode("utf-8", errors="ignore")
        else:
            raw_text = content.decode("utf-8", errors="ignore")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text content provided")

    # Extract questions using AI
    questions = await extract_questions_from_text(raw_text, topic)

    # Tag with topic and company
    for q in questions:
        if topic:
            q["topic"] = topic
        if company:
            q["company"] = company
        q["source"] = "uploaded"

    # Insert into database
    inserted = 0
    if questions:
        inserted = insert_questions(questions)
        await _invalidate_reasoning_read_cache()

    return {
        "extracted": len(questions),
        "inserted": inserted,
        "questions": questions,
        "message": f"Extracted {len(questions)} questions, inserted {inserted} into database",
    }
