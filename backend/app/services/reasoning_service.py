"""
Reasoning & Problem Solving Service — MongoDB-backed question bank,
AI question generation, and user progress tracking.
"""
import json
import logging
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.db.mongodb import get_collection
from app.services.ai_service import ai_hub

logger = logging.getLogger(__name__)

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


def get_topics() -> List[Dict]:
    """Return all available topics with question counts."""
    coll = _get_questions_collection()
    result = []
    for t in TOPICS:
        count = 0
        if coll is not None:
            try:
                count = coll.count_documents({"topic": t["key"]})
            except Exception:
                pass
        result.append({**t, "question_count": count})
    return result


def get_companies() -> List[Dict]:
    """Return all companies with question counts."""
    coll = _get_questions_collection()
    result = []
    for c in COMPANIES:
        count = 0
        if coll is not None:
            try:
                count = coll.count_documents({"company": c["key"]})
            except Exception:
                pass
        result.append({**c, "question_count": count})
    return result


def get_questions_by_topic(
    topic: str,
    difficulty: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
) -> List[Dict]:
    """Fetch questions for a topic from MongoDB."""
    coll = _get_questions_collection()
    if coll is None:
        return []

    query: Dict[str, Any] = {"topic": topic}
    if difficulty:
        query["difficulty"] = difficulty

    try:
        cursor = coll.find(query, {"_id": 0}).skip(skip).limit(limit)
        return list(cursor)
    except Exception:
        logger.exception("Failed to fetch questions for topic %s", topic)
        return []


def get_questions_by_company(
    company: str,
    limit: int = 20,
    skip: int = 0,
) -> List[Dict]:
    """Fetch company-specific questions."""
    coll = _get_questions_collection()
    if coll is None:
        return []

    try:
        cursor = coll.find({"company": company}, {"_id": 0}).skip(skip).limit(limit)
        return list(cursor)
    except Exception:
        logger.exception("Failed to fetch questions for company %s", company)
        return []


def insert_questions(questions: List[Dict]) -> int:
    """Bulk insert questions into the database. Returns count inserted."""
    coll = _get_questions_collection()
    if coll is None:
        return 0

    now = datetime.now(timezone.utc)
    for q in questions:
        q["created_at"] = now

    try:
        result = coll.insert_many(questions)
        return len(result.inserted_ids)
    except Exception:
        logger.exception("Failed to bulk insert questions.")
        return 0


def save_test_result(
    user_id: str,
    test_type: str,
    topic_or_company: str,
    score: int,
    total: int,
    answers: List[Dict],
) -> Optional[str]:
    """Save a test result to MongoDB."""
    coll = _get_tests_collection()
    if coll is None:
        return None

    doc = {
        "user_id": user_id,
        "test_type": test_type,
        "category": topic_or_company,
        "score": score,
        "total": total,
        "accuracy": round((score / total) * 100, 1) if total > 0 else 0,
        "answers": answers,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = coll.insert_one(doc)
        return str(result.inserted_id)
    except Exception:
        logger.exception("Failed to save test result.")
        return None


def record_user_answer(
    user_id: str,
    question_id: str,
    topic: str,
    is_correct: bool,
) -> None:
    """Track per-question user progress."""
    coll = _get_progress_collection()
    if coll is None:
        return

    try:
        coll.update_one(
            {"user_id": user_id, "topic": topic},
            {
                "$inc": {
                    "total_attempted": 1,
                    "correct": 1 if is_correct else 0,
                    "wrong": 0 if is_correct else 1,
                },
                "$set": {"updated_at": datetime.now(timezone.utc)},
                "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
                "$push" if not is_correct else "$addToSet": {
                    "wrong_question_ids": question_id,
                } if not is_correct else {},
            },
            upsert=True,
        )
    except Exception:
        logger.exception("Failed to record user answer.")


def get_user_progress(user_id: str) -> List[Dict]:
    """Get user's topic-wise progress."""
    coll = _get_progress_collection()
    if coll is None:
        return []

    try:
        cursor = coll.find({"user_id": user_id}, {"_id": 0})
        return list(cursor)
    except Exception:
        return []


# ═══════════════════════════════════════════════════════════════
# AI QUESTION GENERATION
# ═══════════════════════════════════════════════════════════════

def _build_generate_questions_prompt(topic: str, difficulty: str, count: int, company: str = "") -> str:
    company_ctx = f"\nThese questions should be in the style of {company} placement exams." if company else ""

    topic_label = topic
    for t in TOPICS:
        if t["key"] == topic:
            topic_label = t["label"]
            break

    return f"""Generate {count} unique reasoning/aptitude questions for placement exam preparation.

Topic: {topic_label}
Difficulty: {difficulty}{company_ctx}

Return a JSON array with EXACTLY this structure (no markdown, no extra text):
[
  {{
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "B",
    "explanation": "Step 1: ...\nStep 2: ...\nStep 3: ...\nTherefore, the answer is B.",
    "difficulty": "{difficulty}"
  }}
]

Rules:
- Each question must have exactly 4 options labeled A, B, C, D
- correct_answer must be one of "A", "B", "C", "D"
- explanation must be step-by-step, clear, and educational
- Questions must be original and placement-exam quality
- Vary the correct answer positions (don't always use B)
- Return ONLY valid JSON, nothing else"""


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
) -> List[Dict]:
    """Use AI to generate reasoning questions. Optionally persist to MongoDB."""
    prompt = _build_generate_questions_prompt(topic, difficulty, count, company)

    try:
        response = await ai_hub.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are an expert aptitude and reasoning question generator. Always respond with valid JSON only.",
        )
        questions = _parse_questions_json(response)
        
        if not questions:
            raise ValueError("AI failed to generate a valid JSON array of questions.")

        # Tag with metadata
        for q in questions:
            q["topic"] = topic
            q["source"] = "ai_generated"
            if company:
                q["company"] = company

        # Auto-persist if requested (background jobs / on-demand populate)
        if persist and questions:
            deduped = _deduplicate_before_insert(questions)
            if deduped:
                inserted = insert_questions(deduped)
                logger.info("Auto-persisted %d questions for topic=%s company=%s", inserted, topic, company)

        return questions

    except Exception as e:
        logger.exception("AI question generation failed: %s", str(e))
        return _get_fallback_questions(topic, count)


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

def _question_hash(q: Dict) -> str:
    """Create a simple hash of a question for deduplication."""
    import hashlib
    text = (q.get("question", "") or "").strip().lower()
    return hashlib.md5(text.encode()).hexdigest()


def _deduplicate_before_insert(questions: List[Dict]) -> List[Dict]:
    """Remove questions that already exist in the DB (by question text hash)."""
    coll = _get_questions_collection()
    if coll is None:
        return questions  # Can't check, insert all

    result = []
    for q in questions:
        q_hash = _question_hash(q)
        q["question_hash"] = q_hash
        try:
            existing = coll.find_one({"question_hash": q_hash})
            if not existing:
                result.append(q)
        except Exception:
            result.append(q)  # On error, allow insertion
    return result


# ═══════════════════════════════════════════════════════════════
# AUTO-POPULATE PIPELINE (Background Job)
# ═══════════════════════════════════════════════════════════════

MIN_QUESTIONS_PER_TOPIC = 10
MIN_QUESTIONS_PER_COMPANY = 5


def count_topic_questions(topic: str) -> int:
    """Count how many questions exist for a topic in MongoDB."""
    coll = _get_questions_collection()
    if coll is None:
        return 0
    try:
        return coll.count_documents({"topic": topic})
    except Exception:
        return 0


def count_company_questions(company: str) -> int:
    """Count how many questions exist for a company in MongoDB."""
    coll = _get_questions_collection()
    if coll is None:
        return 0
    try:
        return coll.count_documents({"company": company})
    except Exception:
        return 0


async def auto_populate_topic(topic: str, target_count: int = MIN_QUESTIONS_PER_TOPIC) -> int:
    """
    Auto-populate a topic if it has fewer than target_count questions.
    Returns number of new questions inserted.
    """
    current = count_topic_questions(topic)
    if current >= target_count:
        return 0

    needed = target_count - current
    # Generate in batches of up to 10
    total_inserted = 0
    for difficulty in ["easy", "medium", "hard"]:
        batch_size = min(5, max(1, needed // 3))
        if needed <= 0:
            break
        questions = await generate_questions_ai(
            topic=topic, difficulty=difficulty, count=batch_size, persist=True,
        )
        total_inserted += len([q for q in questions if q.get("source") != "fallback"])
        needed -= batch_size

    return total_inserted


async def auto_populate_company(company: str, target_count: int = MIN_QUESTIONS_PER_COMPANY) -> int:
    """Auto-populate company questions if below threshold."""
    current = count_company_questions(company)
    if current >= target_count:
        return 0

    needed = target_count - current
    total_inserted = 0

    # Generate questions across a few topics, tagged with company
    topic_keys = [t["key"] for t in TOPICS[:4]]  # First 4 topics
    for topic_key in topic_keys:
        if needed <= 0:
            break
        batch_size = min(3, max(1, needed))
        questions = await generate_questions_ai(
            topic=topic_key, difficulty="medium", count=batch_size,
            company=company, persist=True,
        )
        total_inserted += len([q for q in questions if q.get("source") != "fallback"])
        needed -= batch_size

    return total_inserted


async def auto_populate_all() -> Dict[str, Any]:
    """
    Background job: Cycle through all topics and companies,
    auto-populating any that are below the minimum threshold.
    Also seeds fallback questions into MongoDB on first run.
    """
    results: Dict[str, Any] = {"topics": {}, "companies": {}, "fallback_seeded": 0}

    coll = _get_questions_collection()
    if coll is None:
        raise RuntimeError("MongoDB is not configured or failed to connect.")

    # 1. Seed fallback questions into MongoDB (idempotent via dedup hash)
    fallback_total = 0
    for topic_key, questions in _FALLBACK_DB.items():
        tagged = []
        for q in questions:
            tagged.append({
                **q,
                "topic": topic_key,
                "source": "fallback_seed",
            })
        deduped = _deduplicate_before_insert(tagged)
        if deduped:
            inserted = insert_questions(deduped)
            fallback_total += inserted 
    results["fallback_seeded"] = fallback_total

    # 2. Auto-populate each topic via AI
    for t in TOPICS:
        try:
            inserted = await auto_populate_topic(t["key"])
            results["topics"][t["key"]] = inserted
        except Exception as e:
            logger.error("Failed to auto-populate topic %s: %s", t["key"], str(e))
            results["topics"][t["key"]] = f"error: {str(e)}"

    # 3. Auto-populate each company via AI
    for c in COMPANIES:
        try:
            inserted = await auto_populate_company(c["key"])
            results["companies"][c["key"]] = inserted
        except Exception as e:
            logger.error("Failed to auto-populate company %s: %s", c["key"], str(e))
            results["companies"][c["key"]] = f"error: {str(e)}"

    return results


async def on_demand_populate(topic: str = "", company: str = "") -> List[Dict]:
    """
    Called when user opens a topic/company page and DB is empty.
    Generates questions, persists them, and returns them.
    """
    if topic:
        count = count_topic_questions(topic)
        if count > 0:
            return get_questions_by_topic(topic, limit=20)

        # Generate + persist
        questions = await generate_questions_ai(topic=topic, difficulty="medium", count=10, persist=True)
        return questions

    if company:
        count = count_company_questions(company)
        if count > 0:
            return get_questions_by_company(company, limit=20)

        questions = await generate_questions_ai(
            topic="coding-decoding", difficulty="medium", count=10,
            company=company, persist=True,
        )
        return questions

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


def _get_fallback_questions(topic: str, count: int = 5) -> List[Dict]:
    """Return fallback questions when AI is unavailable."""
    pool = _FALLBACK_DB.get(topic, [])
    if not pool:
        # Return from any available pool
        all_q = []
        for qs in _FALLBACK_DB.values():
            all_q.extend(qs)
        pool = all_q

    selected = pool[:count] if len(pool) <= count else random.sample(pool, min(count, len(pool)))
    for i, q in enumerate(selected):
        q["id"] = f"fallback-{topic}-{i}"
        q["topic"] = topic
        q["source"] = "fallback"
    return selected
