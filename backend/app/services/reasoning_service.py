"""
Reasoning & Problem Solving Service — MongoDB-backed question bank,
AI question generation, and user progress tracking.
"""
import copy
import hashlib
import json
import logging
import random
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Set

from pymongo import UpdateOne
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.mongodb import get_collection
from app.db.session import SessionLocal
from app.models.reasoning import (
    ReasoningQuestion,
    ReasoningTest,
    ReasoningUserProgress,
)
from app.services.ai_service import ai_hub

logger = logging.getLogger(__name__)

DEFAULT_TOPIC_FETCH_LIMIT = 36
DEFAULT_COMPANY_FETCH_LIMIT = 30
ON_DEMAND_TOPIC_TARGET = 18
ON_DEMAND_COMPANY_TARGET = 12
MIN_QUESTIONS_PER_TOPIC = 36
MIN_QUESTIONS_PER_COMPANY = 24
MAX_AI_GENERATION_REQUEST = 60
TOPIC_GENERATION_BATCH_SIZE = 12
COMPANY_GENERATION_BATCH_SIZE = 4
MAX_POPULATE_ATTEMPTS = 8
_sql_storage_ready = False

# ═══════════════════════════════════════════════════════════════
# TOPIC & COMPANY DEFINITIONS
# ═══════════════════════════════════════════════════════════════

TOPICS = [
    {"key": "coding-decoding", "label": "Coding-Decoding", "icon": "🔐", "desc": "Letter/number coding patterns"},
    {"key": "blood-relations", "label": "Blood Relations", "icon": "👨‍👩‍👧‍👦", "desc": "Family relationship puzzles"},
    {"key": "seating-arrangement", "label": "Seating Arrangement", "icon": "🪑", "desc": "Circular & linear arrangement"},
    {"key": "puzzles", "label": "Puzzles", "icon": "🧩", "desc": "Logic puzzles & brain teasers"},
    {"key": "syllogisms", "label": "Syllogisms", "icon": "🔄", "desc": "Statement & conclusion logic"},
    {"key": "number-series", "label": "Number Series", "icon": "🔢", "desc": "Find the pattern in sequences"},
    {"key": "analogy", "label": "Analogy", "icon": "🔗", "desc": "Word & number analogies"},
    {"key": "percentages", "label": "Percentages", "icon": "📊", "desc": "Percentage calculations"},
    {"key": "profit-loss", "label": "Profit & Loss", "icon": "💰", "desc": "Business math problems"},
    {"key": "time-work", "label": "Time & Work", "icon": "⏱️", "desc": "Work rate problems"},
    {"key": "averages", "label": "Averages", "icon": "📈", "desc": "Mean, median calculations"},
    {"key": "ratio-proportion", "label": "Ratio & Proportion", "icon": "⚖️", "desc": "Ratio-based problems"},
]

COMPANIES = [
    {"key": "tcs", "label": "TCS", "icon": "🏢"},
    {"key": "infosys", "label": "Infosys", "icon": "🏛️"},
    {"key": "wipro", "label": "Wipro", "icon": "🌐"},
    {"key": "accenture", "label": "Accenture", "icon": "💼"},
    {"key": "cognizant", "label": "Cognizant", "icon": "🔷"},
    {"key": "capgemini", "label": "Capgemini", "icon": "🔶"},
    {"key": "hcl", "label": "HCL Technologies", "icon": "🏭"},
    {"key": "deloitte", "label": "Deloitte", "icon": "📐"},
]


# ═══════════════════════════════════════════════════════════════
# DATABASE OPERATIONS
# ═══════════════════════════════════════════════════════════════

def _get_questions_collection():
    return get_collection("reasoning_questions")


def _get_tests_collection():
    return get_collection("reasoning_tests")


def _get_progress_collection():
    return get_collection("reasoning_user_progress")


def _ensure_sql_storage_ready(session: Session) -> None:
    global _sql_storage_ready
    if _sql_storage_ready:
        return

    bind = session.get_bind()
    ReasoningQuestion.__table__.create(bind=bind, checkfirst=True)
    ReasoningTest.__table__.create(bind=bind, checkfirst=True)
    ReasoningUserProgress.__table__.create(bind=bind, checkfirst=True)
    _sql_storage_ready = True


def _get_sql_session() -> Optional[Session]:
    session: Optional[Session] = None
    try:
        session = SessionLocal()
        _ensure_sql_storage_ready(session)
        return session
    except Exception:
        logger.exception("Reasoning relational storage is unavailable.")
        if session is not None:
            session.close()
        return None


def get_reasoning_storage_backend() -> str:
    if _get_questions_collection() is not None:
        return "mongodb"

    session = _get_sql_session()
    if session is None:
        return "unavailable"

    try:
        return session.get_bind().dialect.name
    finally:
        session.close()


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_key(value: Any) -> str:
    return _normalize_text(value).lower()


def _canonical_question_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _normalize_text(value).lower()).strip()


def _question_hash(question: Dict[str, Any]) -> str:
    return hashlib.md5(_canonical_question_text(question.get("question")).encode("utf-8")).hexdigest()


def _normalize_options(options: Any) -> List[str]:
    if not isinstance(options, list):
        return []

    normalized = [_normalize_text(option) for option in options if _normalize_text(option)]
    if len(normalized) < 4:
        return []
    return normalized[:4]


def _normalize_correct_answer(correct_answer: Any, options: Sequence[str]) -> str:
    labels = ["A", "B", "C", "D"]

    if isinstance(correct_answer, int) and 0 <= correct_answer < len(labels):
        return labels[correct_answer]

    answer = _normalize_text(correct_answer).upper()
    if answer in labels:
        return answer

    match = re.match(r"^([A-D])\b", answer)
    if match:
        return match.group(1)

    for index, option in enumerate(options[:4]):
        if answer and answer == option.upper():
            return labels[index]

    return "A"


def _normalize_difficulty(value: Any, default: str = "medium") -> str:
    difficulty = _normalize_key(value) or default
    return difficulty if difficulty in {"easy", "medium", "hard"} else default


def _prepare_question_payload(
    raw_question: Dict[str, Any],
    *,
    default_topic: str = "",
    default_company: str = "",
    default_difficulty: str = "medium",
    default_source: str = "ai_generated",
) -> Optional[Dict[str, Any]]:
    question_text = _normalize_text(raw_question.get("question"))
    options = _normalize_options(raw_question.get("options"))
    if not question_text or len(options) != 4:
        return None

    payload: Dict[str, Any] = {
        "question": question_text,
        "options": options,
        "correct_answer": _normalize_correct_answer(raw_question.get("correct_answer"), options),
        "explanation": _normalize_text(raw_question.get("explanation")) or "Explanation unavailable.",
        "difficulty": _normalize_difficulty(raw_question.get("difficulty"), default_difficulty),
        "topic": _normalize_key(raw_question.get("topic") or default_topic) or None,
        "company": _normalize_key(raw_question.get("company") or default_company) or None,
        "source": _normalize_key(raw_question.get("source") or default_source) or default_source,
    }
    payload["question_hash"] = _question_hash(payload)
    return payload


def _prepare_question_batch(questions: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    prepared: List[Dict[str, Any]] = []
    seen_hashes: Set[str] = set()

    for question in questions:
        payload = _prepare_question_payload(question)
        if not payload:
            continue
        if payload["question_hash"] in seen_hashes:
            continue
        seen_hashes.add(payload["question_hash"])
        prepared.append(payload)

    return prepared


def _serialize_sql_question(row: ReasoningQuestion) -> Dict[str, Any]:
    return {
        "id": row.id,
        "topic": row.topic,
        "company": row.company,
        "difficulty": row.difficulty,
        "question": row.question,
        "options": list(row.options or []),
        "correct_answer": row.correct_answer,
        "explanation": row.explanation,
        "source": row.source,
        "question_hash": row.question_hash,
        "created_at": row.created_at,
    }


def _existing_question_hashes(question_hashes: Sequence[str]) -> Set[str]:
    hashes = [question_hash for question_hash in question_hashes if question_hash]
    if not hashes:
        return set()

    coll = _get_questions_collection()
    if coll is not None:
        try:
            cursor = coll.find(
                {"question_hash": {"$in": hashes}},
                {"_id": 0, "question_hash": 1},
            )
            return {doc["question_hash"] for doc in cursor if doc.get("question_hash")}
        except Exception:
            logger.exception("Failed to check MongoDB reasoning question hashes.")

    session = _get_sql_session()
    if session is None:
        return set()

    try:
        rows = (
            session.query(ReasoningQuestion.question_hash)
            .filter(ReasoningQuestion.question_hash.in_(hashes))
            .all()
        )
        return {row[0] for row in rows if row and row[0]}
    except SQLAlchemyError:
        logger.exception("Failed to check relational reasoning question hashes.")
        return set()
    finally:
        session.close()


def get_topics() -> List[Dict]:
    return [{**topic, "question_count": count_topic_questions(topic["key"])} for topic in TOPICS]


def get_companies() -> List[Dict]:
    return [{**company, "question_count": count_company_questions(company["key"])} for company in COMPANIES]


def get_questions_by_topic(
    topic: str,
    difficulty: Optional[str] = None,
    limit: int = DEFAULT_TOPIC_FETCH_LIMIT,
    skip: int = 0,
) -> List[Dict]:
    normalized_topic = _normalize_key(topic)
    normalized_difficulty = _normalize_difficulty(difficulty, "") if difficulty else ""
    safe_limit = max(1, min(limit, 100))
    safe_skip = max(skip, 0)

    coll = _get_questions_collection()
    if coll is not None:
        query: Dict[str, Any] = {"topic": normalized_topic}
        if normalized_difficulty:
            query["difficulty"] = normalized_difficulty
        try:
            cursor = (
                coll.find(query, {"_id": 0})
                .sort("created_at", -1)
                .skip(safe_skip)
                .limit(safe_limit)
            )
            return list(cursor)
        except Exception:
            logger.exception("Failed to fetch MongoDB topic questions for %s.", normalized_topic)

    session = _get_sql_session()
    if session is None:
        return []

    try:
        query = session.query(ReasoningQuestion).filter(ReasoningQuestion.topic == normalized_topic)
        if normalized_difficulty:
            query = query.filter(ReasoningQuestion.difficulty == normalized_difficulty)
        rows = (
            query.order_by(ReasoningQuestion.created_at.desc())
            .offset(safe_skip)
            .limit(safe_limit)
            .all()
        )
        return [_serialize_sql_question(row) for row in rows]
    except SQLAlchemyError:
        logger.exception("Failed to fetch relational topic questions for %s.", normalized_topic)
        return []
    finally:
        session.close()


def get_questions_by_company(
    company: str,
    limit: int = DEFAULT_COMPANY_FETCH_LIMIT,
    skip: int = 0,
) -> List[Dict]:
    normalized_company = _normalize_key(company)
    safe_limit = max(1, min(limit, 100))
    safe_skip = max(skip, 0)

    coll = _get_questions_collection()
    if coll is not None:
        try:
            cursor = (
                coll.find({"company": normalized_company}, {"_id": 0})
                .sort("created_at", -1)
                .skip(safe_skip)
                .limit(safe_limit)
            )
            return list(cursor)
        except Exception:
            logger.exception("Failed to fetch MongoDB company questions for %s.", normalized_company)

    session = _get_sql_session()
    if session is None:
        return []

    try:
        rows = (
            session.query(ReasoningQuestion)
            .filter(ReasoningQuestion.company == normalized_company)
            .order_by(ReasoningQuestion.created_at.desc())
            .offset(safe_skip)
            .limit(safe_limit)
            .all()
        )
        return [_serialize_sql_question(row) for row in rows]
    except SQLAlchemyError:
        logger.exception("Failed to fetch relational company questions for %s.", normalized_company)
        return []
    finally:
        session.close()


def insert_questions(questions: List[Dict]) -> int:
    prepared = _prepare_question_batch(questions)
    if not prepared:
        return 0

    existing_hashes = _existing_question_hashes([question["question_hash"] for question in prepared])
    to_insert = [question for question in prepared if question["question_hash"] not in existing_hashes]
    if not to_insert:
        return 0

    coll = _get_questions_collection()
    if coll is not None:
        try:
            now = datetime.now(timezone.utc)
            operations = [
                UpdateOne(
                    {"question_hash": question["question_hash"]},
                    {"$setOnInsert": {**question, "created_at": now}},
                    upsert=True,
                )
                for question in to_insert
            ]
            result = coll.bulk_write(operations, ordered=False)
            return int(result.upserted_count)
        except Exception:
            logger.exception("Failed to insert reasoning questions into MongoDB.")

    session = _get_sql_session()
    if session is None:
        return 0

    try:
        rows = [
            ReasoningQuestion(
                topic=question.get("topic"),
                company=question.get("company"),
                difficulty=question["difficulty"],
                question=question["question"],
                options=question["options"],
                correct_answer=question["correct_answer"],
                explanation=question["explanation"],
                source=question["source"],
                question_hash=question["question_hash"],
            )
            for question in to_insert
        ]
        session.add_all(rows)
        session.commit()
        return len(rows)
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Failed to insert reasoning questions into relational storage.")
        return 0
    finally:
        session.close()


def save_test_result(
    user_id: str,
    test_type: str,
    topic_or_company: str,
    score: int,
    total: int,
    answers: List[Dict],
) -> Optional[str]:
    accuracy = round((score / total) * 100, 1) if total > 0 else 0

    coll = _get_tests_collection()
    if coll is not None:
        try:
            result = coll.insert_one(
                {
                    "user_id": user_id,
                    "test_type": test_type,
                    "category": topic_or_company,
                    "score": score,
                    "total": total,
                    "accuracy": accuracy,
                    "answers": answers,
                    "created_at": datetime.now(timezone.utc),
                }
            )
            return str(result.inserted_id)
        except Exception:
            logger.exception("Failed to save reasoning test result to MongoDB.")

    session = _get_sql_session()
    if session is None:
        return None

    try:
        row = ReasoningTest(
            user_id=user_id,
            test_type=test_type,
            category=topic_or_company,
            score=score,
            total=total,
            accuracy=accuracy,
            answers=answers,
        )
        session.add(row)
        session.commit()
        return row.id
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Failed to save reasoning test result to relational storage.")
        return None
    finally:
        session.close()


def record_user_answer(
    user_id: str,
    question_id: str,
    topic: str,
    is_correct: bool,
) -> None:
    normalized_topic = _normalize_key(topic)
    now = datetime.now(timezone.utc)

    coll = _get_progress_collection()
    if coll is not None:
        try:
            update_doc: Dict[str, Any] = {
                "$inc": {
                    "total_attempted": 1,
                    "correct": 1 if is_correct else 0,
                    "wrong": 0 if is_correct else 1,
                },
                "$set": {"updated_at": now},
                "$setOnInsert": {"created_at": now},
            }
            if not is_correct:
                update_doc["$addToSet"] = {"wrong_question_ids": question_id}

            coll.update_one(
                {"user_id": user_id, "topic": normalized_topic},
                update_doc,
                upsert=True,
            )
            return
        except Exception:
            logger.exception("Failed to record reasoning answer to MongoDB.")

    session = _get_sql_session()
    if session is None:
        return

    try:
        progress = (
            session.query(ReasoningUserProgress)
            .filter(
                ReasoningUserProgress.user_id == user_id,
                ReasoningUserProgress.topic == normalized_topic,
            )
            .one_or_none()
        )
        if progress is None:
            progress = ReasoningUserProgress(
                user_id=user_id,
                topic=normalized_topic,
                total_attempted=0,
                correct=0,
                wrong=0,
                wrong_question_ids=[],
            )
            session.add(progress)

        progress.total_attempted += 1
        if is_correct:
            progress.correct += 1
        else:
            progress.wrong += 1
            wrong_ids = list(progress.wrong_question_ids or [])
            if question_id not in wrong_ids:
                wrong_ids.append(question_id)
            progress.wrong_question_ids = wrong_ids
        progress.updated_at = now
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Failed to record reasoning answer to relational storage.")
    finally:
        session.close()


def get_user_progress(user_id: str) -> List[Dict]:
    coll = _get_progress_collection()
    if coll is not None:
        try:
            cursor = coll.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1)
            return list(cursor)
        except Exception:
            logger.exception("Failed to fetch reasoning progress from MongoDB.")

    session = _get_sql_session()
    if session is None:
        return []

    try:
        rows = (
            session.query(ReasoningUserProgress)
            .filter(ReasoningUserProgress.user_id == user_id)
            .order_by(ReasoningUserProgress.updated_at.desc())
            .all()
        )
        return [
            {
                "user_id": row.user_id,
                "topic": row.topic,
                "total_attempted": row.total_attempted,
                "correct": row.correct,
                "wrong": row.wrong,
                "wrong_question_ids": list(row.wrong_question_ids or []),
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in rows
        ]
    except SQLAlchemyError:
        logger.exception("Failed to fetch reasoning progress from relational storage.")
        return []
    finally:
        session.close()


# ═══════════════════════════════════════════════════════════════
# AI QUESTION GENERATION
# ═══════════════════════════════════════════════════════════════

def _trim_prompt_text(text: str, limit: int = 180) -> str:
    normalized = _normalize_text(text)
    return normalized if len(normalized) <= limit else f"{normalized[: limit - 3]}..."


def _build_generate_questions_prompt(
    topic: str,
    difficulty: str,
    count: int,
    company: str = "",
    exclude_questions: Optional[Sequence[str]] = None,
) -> str:
    topic_label = next((item["label"] for item in TOPICS if item["key"] == topic), topic)
    company_ctx = (
        f"\nCompany style: {company.upper()} campus-placement questions inspired by previous-year patterns."
        if company
        else ""
    )
    avoid_ctx = ""
    if exclude_questions:
        sampled = [_trim_prompt_text(item) for item in exclude_questions if _normalize_text(item)][:10]
        if sampled:
            avoid_ctx = "\nAvoid repeating or lightly paraphrasing any of these existing questions:\n"
            avoid_ctx += "\n".join(f"- {item}" for item in sampled)

    return f"""Generate {count} unique reasoning/aptitude questions for placement exam preparation.

Topic: {topic_label}
Difficulty: {difficulty}{company_ctx}
{avoid_ctx}

Return a JSON array with EXACTLY this structure (no markdown, no extra text):
[
  {{
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "B",
    "explanation": "Step 1: ...\\nStep 2: ...\\nStep 3: ...\\nTherefore, the answer is B.",
    "difficulty": "{difficulty}"
  }}
]

Rules:
- Each question must have exactly 4 options.
- correct_answer must be one of "A", "B", "C", "D".
- explanation must be step-by-step, clear, and educational.
- Questions must feel like realistic placement-exam questions, not trivia.
- Use different numbers, names, and setups so no two questions are near-duplicates.
- Vary the correct-answer positions across A, B, C, and D.
- Return ONLY valid JSON, nothing else."""


def _build_extract_questions_prompt(text: str, topic: str = "") -> str:
    topic_ctx = f" Topic hint: {topic}." if topic else ""

    return f"""Extract structured questions from the following text.{topic_ctx}

TEXT:
\"\"\"
{text[:8000]}
\"\"\"

For each question found, extract:
- The question text
- Options (A, B, C, D)
- Correct answer (if provided)
- Explanation (if provided, otherwise generate a step-by-step explanation)

Return a JSON array with this structure (no markdown):
[
  {{
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correct_answer": "A/B/C/D",
    "explanation": "Step-by-step explanation...",
    "difficulty": "easy/medium/hard"
  }}
]

Rules:
- If the answer is not in the text, determine it logically and explain
- If the explanation is missing, generate one step-by-step
- Return ONLY valid JSON, nothing else"""


async def generate_questions_ai(
    topic: str,
    difficulty: str = "medium",
    count: int = 5,
    company: str = "",
    persist: bool = False,
    exclude_questions: Optional[Sequence[str]] = None,
) -> List[Dict]:
    normalized_topic = _normalize_key(topic)
    normalized_company = _normalize_key(company)
    normalized_difficulty = _normalize_difficulty(difficulty)
    safe_count = max(1, min(count, MAX_AI_GENERATION_REQUEST))
    prompt = _build_generate_questions_prompt(
        normalized_topic,
        normalized_difficulty,
        safe_count,
        normalized_company,
        exclude_questions=exclude_questions,
    )

    try:
        response = await ai_hub.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are an expert aptitude and reasoning question generator. Always respond with valid JSON only.",
        )
        questions = _sanitize_generated_questions(
            _parse_questions_json(response),
            topic=normalized_topic,
            difficulty=normalized_difficulty,
            company=normalized_company,
        )
        if not questions:
            raise ValueError("AI failed to return a valid question array.")

        if persist:
            inserted = insert_questions(questions)
            logger.info(
                "Persisted %d reasoning questions for topic=%s company=%s",
                inserted,
                normalized_topic,
                normalized_company,
            )

        return questions[:safe_count]

    except Exception as e:
        logger.exception(
            "AI question generation failed for topic=%s company=%s: %s",
            normalized_topic,
            normalized_company,
            str(e),
        )
        return _get_fallback_questions(normalized_topic, safe_count, company=normalized_company)


async def extract_questions_from_text(text: str, topic: str = "") -> List[Dict]:
    """Use AI to extract structured questions from raw text."""
    prompt = _build_extract_questions_prompt(text, topic)

    try:
        response = await ai_hub.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are an expert at extracting exam questions from text. Always respond with valid JSON only.",
        )
        return _parse_questions_json(response)
    except Exception as e:
        logger.exception("Question extraction failed: %s", str(e))
        return []


def _parse_questions_json(text: str) -> List[Dict]:
    """Parse JSON array of questions from AI response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        result = json.loads(cleaned)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        start = cleaned.find("[")
        end = cleaned.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                result = json.loads(cleaned[start:end])
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass
    return []


# ═══════════════════════════════════════════════════════════════
# DEDUPLICATION
# ═══════════════════════════════════════════════════════════════

def _sanitize_generated_questions(
    questions: Sequence[Dict[str, Any]],
    *,
    topic: str,
    difficulty: str,
    company: str = "",
    source: str = "ai_generated",
) -> List[Dict[str, Any]]:
    sanitized: List[Dict[str, Any]] = []
    seen_hashes: Set[str] = set()

    for question in questions:
        payload = _prepare_question_payload(
            question,
            default_topic=topic,
            default_company=company,
            default_difficulty=difficulty,
            default_source=source,
        )
        if not payload:
            continue
        if payload["question_hash"] in seen_hashes:
            continue
        seen_hashes.add(payload["question_hash"])
        sanitized.append(payload)

    return sanitized


def _deduplicate_before_insert(questions: List[Dict]) -> List[Dict]:
    prepared = _prepare_question_batch(questions)
    if not prepared:
        return []

    existing_hashes = _existing_question_hashes([question["question_hash"] for question in prepared])
    return [question for question in prepared if question["question_hash"] not in existing_hashes]


def _get_existing_question_texts(
    *,
    topic: str = "",
    company: str = "",
    limit: int = 12,
) -> List[str]:
    if company:
        return [
            question["question"]
            for question in get_questions_by_company(company, limit=limit)
            if question.get("question")
        ]
    if topic:
        return [
            question["question"]
            for question in get_questions_by_topic(topic, limit=limit)
            if question.get("question")
        ]
    return []


def seed_fallback_questions(topic_keys: Optional[Sequence[str]] = None) -> int:
    selected_keys = {_normalize_key(key) for key in (topic_keys or _FALLBACK_DB.keys())}
    payloads: List[Dict[str, Any]] = []

    for topic_key, questions in _FALLBACK_DB.items():
        if selected_keys and topic_key not in selected_keys:
            continue
        for question in questions:
            payloads.append(
                {
                    **copy.deepcopy(question),
                    "topic": topic_key,
                    "source": "fallback_seed",
                }
            )

    return insert_questions(payloads)


# ═══════════════════════════════════════════════════════════════
# AUTO-POPULATE PIPELINE (Background Job)
# ═══════════════════════════════════════════════════════════════

def count_topic_questions(topic: str) -> int:
    normalized_topic = _normalize_key(topic)
    if not normalized_topic:
        return 0

    coll = _get_questions_collection()
    if coll is not None:
        try:
            return coll.count_documents({"topic": normalized_topic})
        except Exception:
            logger.exception("Failed to count MongoDB topic questions for %s.", normalized_topic)

    session = _get_sql_session()
    if session is None:
        return 0

    try:
        return int(
            session.query(func.count(ReasoningQuestion.id))
            .filter(ReasoningQuestion.topic == normalized_topic)
            .scalar()
            or 0
        )
    except SQLAlchemyError:
        logger.exception("Failed to count relational topic questions for %s.", normalized_topic)
        return 0
    finally:
        session.close()


def count_company_questions(company: str) -> int:
    normalized_company = _normalize_key(company)
    if not normalized_company:
        return 0

    coll = _get_questions_collection()
    if coll is not None:
        try:
            return coll.count_documents({"company": normalized_company})
        except Exception:
            logger.exception("Failed to count MongoDB company questions for %s.", normalized_company)

    session = _get_sql_session()
    if session is None:
        return 0

    try:
        return int(
            session.query(func.count(ReasoningQuestion.id))
            .filter(ReasoningQuestion.company == normalized_company)
            .scalar()
            or 0
        )
    except SQLAlchemyError:
        logger.exception("Failed to count relational company questions for %s.", normalized_company)
        return 0
    finally:
        session.close()


def count_all_questions() -> int:
    coll = _get_questions_collection()
    if coll is not None:
        try:
            return coll.count_documents({})
        except Exception:
            logger.exception("Failed to count reasoning questions in MongoDB.")

    session = _get_sql_session()
    if session is None:
        return 0

    try:
        return int(session.query(func.count(ReasoningQuestion.id)).scalar() or 0)
    except SQLAlchemyError:
        logger.exception("Failed to count reasoning questions in relational storage.")
        return 0
    finally:
        session.close()


async def auto_populate_topic(topic: str, target_count: int = MIN_QUESTIONS_PER_TOPIC) -> int:
    normalized_topic = _normalize_key(topic)
    if count_topic_questions(normalized_topic) >= target_count:
        return 0

    inserted_total = 0
    stalled_attempts = 0
    difficulties = ["easy", "medium", "hard"]

    for attempt in range(MAX_POPULATE_ATTEMPTS):
        current = count_topic_questions(normalized_topic)
        if current >= target_count:
            break

        needed = target_count - current
        batch_size = min(TOPIC_GENERATION_BATCH_SIZE, max(4, needed))
        generated = await generate_questions_ai(
            topic=normalized_topic,
            difficulty=difficulties[attempt % len(difficulties)],
            count=batch_size,
            persist=False,
            exclude_questions=_get_existing_question_texts(topic=normalized_topic, limit=16),
        )
        inserted = insert_questions(generated)
        inserted_total += inserted
        stalled_attempts = stalled_attempts + 1 if inserted == 0 else 0
        if stalled_attempts >= 2:
            break

    return inserted_total


async def auto_populate_company(company: str, target_count: int = MIN_QUESTIONS_PER_COMPANY) -> int:
    normalized_company = _normalize_key(company)
    if count_company_questions(normalized_company) >= target_count:
        return 0

    inserted_total = 0
    stalled_attempts = 0
    topic_keys = [topic["key"] for topic in TOPICS]
    difficulties = ["medium", "hard", "easy"]

    for attempt in range(MAX_POPULATE_ATTEMPTS * 2):
        current = count_company_questions(normalized_company)
        if current >= target_count:
            break

        needed = target_count - current
        batch_size = min(COMPANY_GENERATION_BATCH_SIZE, max(1, needed))
        generated = await generate_questions_ai(
            topic=topic_keys[attempt % len(topic_keys)],
            difficulty=difficulties[attempt % len(difficulties)],
            count=batch_size,
            company=normalized_company,
            persist=False,
            exclude_questions=_get_existing_question_texts(company=normalized_company, limit=18),
        )
        inserted = insert_questions(generated)
        inserted_total += inserted
        stalled_attempts = stalled_attempts + 1 if inserted == 0 else 0
        if stalled_attempts >= 3:
            break

    return inserted_total


async def auto_populate_all() -> Dict[str, Any]:
    backend = get_reasoning_storage_backend()
    if backend == "unavailable":
        raise RuntimeError("No reasoning storage backend is available.")

    results: Dict[str, Any] = {
        "storage_backend": backend,
        "targets": {
            "topic_minimum": MIN_QUESTIONS_PER_TOPIC,
            "company_minimum": MIN_QUESTIONS_PER_COMPANY,
        },
        "topics": {},
        "companies": {},
        "fallback_seeded": seed_fallback_questions(),
    }

    for topic in TOPICS:
        try:
            results["topics"][topic["key"]] = await auto_populate_topic(topic["key"])
        except Exception as e:
            logger.error("Failed to auto-populate topic %s: %s", topic["key"], str(e))
            results["topics"][topic["key"]] = f"error: {str(e)}"

    for company in COMPANIES:
        try:
            results["companies"][company["key"]] = await auto_populate_company(company["key"])
        except Exception as e:
            logger.error("Failed to auto-populate company %s: %s", company["key"], str(e))
            results["companies"][company["key"]] = f"error: {str(e)}"

    return results


async def on_demand_populate(topic: str = "", company: str = "") -> List[Dict]:
    normalized_topic = _normalize_key(topic)
    normalized_company = _normalize_key(company)

    if normalized_topic:
        existing = get_questions_by_topic(normalized_topic, limit=DEFAULT_TOPIC_FETCH_LIMIT)
        if existing:
            return existing

        seed_fallback_questions([normalized_topic])
        await auto_populate_topic(normalized_topic, target_count=ON_DEMAND_TOPIC_TARGET)
        hydrated = get_questions_by_topic(normalized_topic, limit=DEFAULT_TOPIC_FETCH_LIMIT)
        if hydrated:
            return hydrated

        return await generate_questions_ai(
            topic=normalized_topic,
            difficulty="medium",
            count=ON_DEMAND_TOPIC_TARGET,
            persist=False,
        )

    if normalized_company:
        existing = get_questions_by_company(normalized_company, limit=DEFAULT_COMPANY_FETCH_LIMIT)
        if existing:
            return existing

        await auto_populate_company(normalized_company, target_count=ON_DEMAND_COMPANY_TARGET)
        hydrated = get_questions_by_company(normalized_company, limit=DEFAULT_COMPANY_FETCH_LIMIT)
        if hydrated:
            return hydrated

        return await generate_questions_ai(
            topic=TOPICS[0]["key"],
            difficulty="medium",
            count=ON_DEMAND_COMPANY_TARGET,
            company=normalized_company,
            persist=False,
        )

    return []


# ═══════════════════════════════════════════════════════════════
# FALLBACK QUESTIONS
# ═══════════════════════════════════════════════════════════════

_FALLBACK_DB: Dict[str, List[Dict]] = {
    "coding-decoding": [
        {"question": "If COMPUTER is coded as DPNQVUFS, how is MACHINE coded?", "options": ["NBDIJOF", "NBDIJOH", "NBDIJOG", "NCDIJOF"], "correct_answer": "A", "explanation": "Step 1: Each letter is shifted +1 in the alphabet.\nStep 2: M→N, A→B, C→D, H→I, I→J, N→O, E→F\nStep 3: MACHINE → NBDIJOF", "difficulty": "easy"},
        {"question": "In a certain code, SEND is written as VHQG. How will HELP be written?", "options": ["KHOS", "KHOR", "JHOR", "KHOS"], "correct_answer": "A", "explanation": "Step 1: Each letter is shifted +3 positions.\nStep 2: H→K, E→H, L→O, P→S\nStep 3: HELP → KHOS", "difficulty": "easy"},
        {"question": "If CAT = 24 and DOG = 26, what is COW?", "options": ["38", "41", "40", "39"], "correct_answer": "C", "explanation": "Step 1: Assign A=1, B=2, ..., Z=26\nStep 2: C=3, A=1, T=20 → 3+1+20=24 ✓\nStep 3: D=4, O=15, G=7 → 4+15+7=26 ✓\nStep 4: C=3, O=15, W=23 → 3+15+23=41... Wait, let me recalculate.\nActually: C=3, O=15, W=23 → 3+15+22=40", "difficulty": "medium"},
        {"question": "If ROSE is coded as 6821, CHAIR is coded as 73456, and PREACH is coded as 961473, what is the code for SEARCH?", "options": ["214673", "214673", "214637", "216473"], "correct_answer": "A", "explanation": "Step 1: Map each letter: R=6, O=8, S=2, E=1, C=7, H=3, A=4, I=5, P=9\nStep 2: S=2, E=1, A=4, R=6, C=7, H=3\nStep 3: SEARCH → 214673", "difficulty": "medium"},
    ],
    "number-series": [
        {"question": "What comes next: 2, 6, 12, 20, 30, ?", "options": ["42", "40", "38", "44"], "correct_answer": "A", "explanation": "Step 1: Find differences: 6-2=4, 12-6=6, 20-12=8, 30-20=10\nStep 2: Differences increase by 2 each time\nStep 3: Next difference = 12\nStep 4: 30 + 12 = 42", "difficulty": "easy"},
        {"question": "Find the missing number: 3, 9, 27, 81, ?", "options": ["243", "162", "216", "324"], "correct_answer": "A", "explanation": "Step 1: Each number is multiplied by 3\nStep 2: 3×3=9, 9×3=27, 27×3=81\nStep 3: 81×3=243", "difficulty": "easy"},
        {"question": "What comes next: 1, 1, 2, 3, 5, 8, 13, ?", "options": ["21", "18", "20", "19"], "correct_answer": "A", "explanation": "Step 1: This is the Fibonacci sequence\nStep 2: Each number = sum of previous two\nStep 3: 8+13 = 21", "difficulty": "easy"},
    ],
    "blood-relations": [
        {"question": "Pointing to a lady, Ravi said, 'She is the daughter of the woman who is the mother of the husband of my mother.' How is the lady related to Ravi?", "options": ["Aunt", "Grandmother", "Sister", "Daughter"], "correct_answer": "A", "explanation": "Step 1: Mother of Ravi's husband's mother = Ravi's maternal grandmother\nStep 2: Wait — 'husband of my mother' = Ravi's father\nStep 3: 'Mother of the husband of my mother' = Ravi's paternal grandmother\nStep 4: Daughter of Ravi's paternal grandmother = Ravi's father's sister = Ravi's aunt", "difficulty": "medium"},
        {"question": "A is B's sister. C is B's mother. D is C's father. E is D's mother. How is A related to D?", "options": ["Granddaughter", "Daughter", "Grandmother", "Grandfather"], "correct_answer": "A", "explanation": "Step 1: A is B's sister, so A and B are siblings\nStep 2: C is B's (and A's) mother\nStep 3: D is C's father, so D is A's grandfather\nStep 4: Therefore, A is D's granddaughter", "difficulty": "easy"},
    ],
    "syllogisms": [
        {"question": "Statements: All dogs are animals. All animals are living beings.\nConclusions:\nI. All dogs are living beings.\nII. All living beings are dogs.", "options": ["Only I follows", "Only II follows", "Both follow", "Neither follows"], "correct_answer": "A", "explanation": "Step 1: All dogs are animals (given)\nStep 2: All animals are living beings (given)\nStep 3: By transitivity: All dogs → animals → living beings ✓ (Conclusion I follows)\nStep 4: Not all living beings are dogs (plants are living beings too) ✗ (Conclusion II doesn't follow)", "difficulty": "easy"},
    ],
    "percentages": [
        {"question": "If 40% of a number is 80, what is the number?", "options": ["200", "180", "160", "220"], "correct_answer": "A", "explanation": "Step 1: Let the number be x\nStep 2: 40% of x = 80\nStep 3: (40/100) × x = 80\nStep 4: x = 80 × 100/40 = 200", "difficulty": "easy"},
        {"question": "A product's price increased by 20% and then decreased by 20%. What is the net change?", "options": ["4% decrease", "No change", "4% increase", "2% decrease"], "correct_answer": "A", "explanation": "Step 1: Let original price = 100\nStep 2: After 20% increase: 100 × 1.20 = 120\nStep 3: After 20% decrease: 120 × 0.80 = 96\nStep 4: Net change = 96 - 100 = -4, which is a 4% decrease", "difficulty": "medium"},
    ],
    "profit-loss": [
        {"question": "A shopkeeper buys an article for ₹500 and sells it for ₹600. What is the profit percentage?", "options": ["20%", "16.67%", "25%", "10%"], "correct_answer": "A", "explanation": "Step 1: Cost Price (CP) = ₹500\nStep 2: Selling Price (SP) = ₹600\nStep 3: Profit = SP - CP = ₹100\nStep 4: Profit% = (Profit/CP) × 100 = (100/500) × 100 = 20%", "difficulty": "easy"},
    ],
    "analogy": [
        {"question": "Pen is to Writer as Brush is to ?", "options": ["Painter", "Color", "Canvas", "Art"], "correct_answer": "A", "explanation": "Step 1: A pen is the tool used by a writer\nStep 2: Similarly, a brush is the tool used by a painter\nStep 3: The relationship is: Tool → User", "difficulty": "easy"},
    ],
    "puzzles": [
        {"question": "If the day before yesterday was Thursday, what day will it be the day after tomorrow?", "options": ["Monday", "Sunday", "Tuesday", "Saturday"], "correct_answer": "A", "explanation": "Step 1: Day before yesterday = Thursday\nStep 2: Yesterday = Friday\nStep 3: Today = Saturday\nStep 4: Tomorrow = Sunday\nStep 5: Day after tomorrow = Monday", "difficulty": "easy"},
    ],
    "seating-arrangement": [
        {"question": "Five friends A, B, C, D, E sit in a row. B is to the right of A. C is between A and B. D is to the right of B. Where does E sit?", "options": ["Leftmost", "Rightmost", "Between C and D", "Between B and D"], "correct_answer": "A", "explanation": "Step 1: B is right of A → ...A...B...\nStep 2: C is between A and B → A C B\nStep 3: D is right of B → A C B D\nStep 4: Only position left for E → E A C B D\nStep 5: E sits leftmost", "difficulty": "medium"},
    ],
    "time-work": [
        {"question": "A can do a work in 10 days and B can do it in 15 days. In how many days can they finish it together?", "options": ["6 days", "5 days", "8 days", "7 days"], "correct_answer": "A", "explanation": "Step 1: A's work rate = 1/10 per day\nStep 2: B's work rate = 1/15 per day\nStep 3: Combined rate = 1/10 + 1/15 = 3/30 + 2/30 = 5/30 = 1/6\nStep 4: Together they finish in 6 days", "difficulty": "easy"},
    ],
    "averages": [
        {"question": "The average of 5 numbers is 20. If one number is removed, the average becomes 15. What is the removed number?", "options": ["40", "35", "30", "25"], "correct_answer": "A", "explanation": "Step 1: Sum of 5 numbers = 5 × 20 = 100\nStep 2: Sum of remaining 4 numbers = 4 × 15 = 60\nStep 3: Removed number = 100 - 60 = 40", "difficulty": "easy"},
    ],
    "ratio-proportion": [
        {"question": "If A:B = 2:3 and B:C = 4:5, what is A:B:C?", "options": ["8:12:15", "2:3:5", "4:6:5", "8:12:10"], "correct_answer": "A", "explanation": "Step 1: A:B = 2:3, B:C = 4:5\nStep 2: Make B common: A:B = 2×4:3×4 = 8:12\nStep 3: B:C = 4×3:5×3 = 12:15\nStep 4: A:B:C = 8:12:15", "difficulty": "medium"},
    ],
}


def _get_fallback_questions(topic: str, count: int = 5, company: str = "") -> List[Dict]:
    pool = _FALLBACK_DB.get(topic, [])
    if not pool:
        all_questions: List[Dict[str, Any]] = []
        for questions in _FALLBACK_DB.values():
            all_questions.extend(questions)
        pool = all_questions

    sample_size = min(count, len(pool))
    selected = pool[:sample_size] if len(pool) <= sample_size else random.sample(pool, sample_size)
    fallback_questions: List[Dict[str, Any]] = []
    normalized_topic = _normalize_key(topic)
    normalized_company = _normalize_key(company)

    for index, question in enumerate(selected):
        payload = copy.deepcopy(question)
        payload["id"] = f"fallback-{normalized_topic or 'general'}-{index}"
        payload["topic"] = normalized_topic or payload.get("topic")
        payload["source"] = "fallback"
        if normalized_company:
            payload["company"] = normalized_company
        fallback_questions.append(payload)

    return fallback_questions
