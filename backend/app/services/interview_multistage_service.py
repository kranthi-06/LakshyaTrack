"""
Multi-Stage AI Interview Service
Handles 4-stage hiring simulation:
  1. Resume / Application Screening
  2. Technical Interview
  3. Practical / Coding Round
  4. HR / Behavioral Interview
"""
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.services.ai_service import ai_hub
from app.models.career import MultiStageInterview
from app.core.resilience import safe_json_parse, sanitize_for_logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# STAGE 1 — Resume / Application Screening
# ═══════════════════════════════════════════

async def generate_screening_question(
    position: str,
    resume_summary: str,
    history: List[Dict[str, Any]],
    skills: List[str] = [],
    projects: List[str] = [],
) -> str:
    """Generate resume screening questions based on the candidate's resume."""
    context_parts = []
    if resume_summary:
        context_parts.append(f"Resume summary: {resume_summary}")
    if skills:
        context_parts.append(f"Skills listed: {', '.join(skills)}")
    if projects:
        context_parts.append(f"Projects: {', '.join(projects)}")
    context = "\n".join(context_parts)

    system_prompt = f"""
    You are a senior recruiter conducting the APPLICATION SCREENING stage for a {position} role.
    You have the candidate's resume in front of you.

    {context}

    Generate a screening question that asks the candidate about:
    - Their projects (how they built them, challenges faced, decisions made)
    - Technologies they chose and why
    - Their educational background and how it prepared them
    - Their experience and key learnings

    Make the question specific to the candidate's resume content.
    Follow naturally from previous conversation.

    IMPORTANT: Return ONLY the question text. No introductory phrases, numbering, or formatting.
    """

    messages = []
    for entry in history:
        messages.append({"role": "assistant", "content": entry["question"]})
        messages.append({"role": "user", "content": entry["answer"]})

    return await ai_hub.chat_completion(messages, system_prompt)


async def evaluate_screening(
    position: str,
    responses: List[Dict[str, Any]],
    resume_summary: str = "",
) -> dict:
    """Evaluate application screening performance."""
    system_prompt = "You are a senior hiring committee evaluating a candidate's application screening round."
    prompt = f"""
    Evaluate the APPLICATION SCREENING performance for a {position} role.
    Resume context: {resume_summary}

    Candidate's Q&A:
    {json.dumps(responses, indent=2)}

    Evaluate based on:
    - Clarity of explanations
    - Technical depth about their own work
    - Correctness of claims
    - Self-awareness about their skills

    Return STRICT JSON:
    {{
        "score": <number 0-100>,
        "clarity": <number 0-100>,
        "technical_depth": <number 0-100>,
        "correctness": <number 0-100>,
        "feedback": "Detailed paragraph of feedback",
        "strengths": ["...", "..."],
        "weaknesses": ["...", "..."]
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no comments.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )
        result = safe_json_parse(response)
        if result is None:
            raise ValueError("Failed to parse screening evaluation JSON")
        return result
    except Exception as e:
        logger.error("Screening evaluation error: %s", sanitize_for_logging(str(e)))
        return {"score": 50, "clarity": 50, "technical_depth": 50, "correctness": 50,
                "feedback": "Evaluation completed.", "strengths": [], "weaknesses": []}


# ═══════════════════════════════════════════
# STAGE 2 — Technical Interview
# ═══════════════════════════════════════════

async def generate_technical_question(
    position: str,
    skills: List[str],
    history: List[Dict[str, Any]],
) -> str:
    """Generate technical interview questions based on the candidate's skills."""
    skill_list = ", ".join(skills) if skills else "general programming"

    system_prompt = f"""
    You are a senior technical interviewer conducting a TECHNICAL INTERVIEW for a {position} role.
    The candidate has these skills: {skill_list}

    Generate a focused technical question covering one of these areas:
    - Core concepts of the candidate's technologies
    - Architecture and design patterns
    - Problem solving and algorithmic thinking
    - Database design and optimization
    - System design and scalability

    Make the question challenging but fair.
    Follow naturally from previous conversation if applicable.

    IMPORTANT: Return ONLY the question text. No introductory phrases, numbering, or formatting.
    """

    messages = []
    for entry in history:
        messages.append({"role": "assistant", "content": entry["question"]})
        messages.append({"role": "user", "content": entry["answer"]})

    return await ai_hub.chat_completion(messages, system_prompt)


async def evaluate_technical(
    position: str,
    responses: List[Dict[str, Any]],
    skills: List[str] = [],
) -> dict:
    """Evaluate technical interview performance."""
    system_prompt = "You are a senior technical committee evaluating a candidate's technical interview."
    prompt = f"""
    Evaluate the TECHNICAL INTERVIEW performance for a {position} role.
    Skills being assessed: {', '.join(skills) if skills else 'general'}

    Candidate's Q&A:
    {json.dumps(responses, indent=2)}

    Evaluate based on:
    - Technical knowledge depth
    - Explanation quality
    - Problem-solving approach
    - Confidence in answers

    Return STRICT JSON:
    {{
        "score": <number 0-100>,
        "knowledge_depth": <number 0-100>,
        "explanation_quality": <number 0-100>,
        "problem_solving": <number 0-100>,
        "confidence": <number 0-100>,
        "feedback": "Detailed paragraph of feedback",
        "strengths": ["...", "..."],
        "weaknesses": ["...", "..."]
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no comments.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )
        result = safe_json_parse(response)
        if result is None:
            raise ValueError("Failed to parse technical evaluation JSON")
        return result
    except Exception as e:
        logger.error("Technical evaluation error: %s", sanitize_for_logging(str(e)))
        return {"score": 50, "knowledge_depth": 50, "explanation_quality": 50,
                "problem_solving": 50, "confidence": 50,
                "feedback": "Evaluation completed.", "strengths": [], "weaknesses": []}


# ═══════════════════════════════════════════
# STAGE 3 — Practical / Coding Round
# ═══════════════════════════════════════════

async def generate_coding_problem(
    position: str,
    skills: List[str],
    difficulty: str = "intermediate",
) -> dict:
    """Generate a coding problem with test cases."""
    skill_list = ", ".join(skills) if skills else "general programming"

    system_prompt = "You are a senior technical interviewer creating coding challenges."
    prompt = f"""
    Generate a coding challenge for a {position} role at {difficulty} difficulty level.
    Relevant skills: {skill_list}

    Difficulty guidelines:
    - beginner: array/string manipulation, basic logic
    - intermediate: data structures, API logic, moderate algorithms
    - advanced: complex algorithms, optimization problems, system design code

    Return STRICT JSON:
    {{
        "title": "Problem title",
        "description": "Detailed problem description with examples",
        "examples": [
            {{"input": "example input", "output": "expected output"}},
            {{"input": "example input 2", "output": "expected output 2"}}
        ],
        "test_cases": [
            {{"input": "test input", "expected_output": "expected output", "is_hidden": false}},
            {{"input": "hidden test", "expected_output": "expected output", "is_hidden": true}}
        ],
        "hints": ["hint 1", "hint 2"],
        "constraints": "Time and space expectations",
        "starter_code": {{
            "python": "def solution():\\n    # Your code here\\n    pass",
            "javascript": "function solution() {{\\n    // Your code here\\n}}"
        }},
        "difficulty": "{difficulty}",
        "topics": ["relevant", "topics"]
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no comments.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )
        result = safe_json_parse(response)
        if result is None:
            raise ValueError("Failed to parse coding problem JSON")
        return result
    except Exception as e:
        logger.error("Coding problem generation error: %s", sanitize_for_logging(str(e)))
        return {
            "title": "Array Sum Problem",
            "description": "Given an array of integers, find the two numbers that add up to a target sum. Return their indices.",
            "examples": [
                {"input": "nums = [2,7,11,15], target = 9", "output": "[0, 1]"},
                {"input": "nums = [3,2,4], target = 6", "output": "[1, 2]"}
            ],
            "test_cases": [
                {"input": "[2,7,11,15], 9", "expected_output": "[0,1]", "is_hidden": False},
                {"input": "[3,2,4], 6", "expected_output": "[1,2]", "is_hidden": True}
            ],
            "hints": ["Consider using a hash map", "Think about complement values"],
            "constraints": "O(n) time complexity preferred",
            "starter_code": {
                "python": "def two_sum(nums, target):\n    # Your code here\n    pass",
                "javascript": "function twoSum(nums, target) {\n    // Your code here\n}"
            },
            "difficulty": difficulty,
            "topics": ["arrays", "hash-map"]
        }


async def evaluate_coding(
    position: str,
    problem: dict,
    code: str,
    language: str,
    passed_tests: int,
    total_tests: int,
    attempts: int,
) -> dict:
    """Evaluate coding round performance."""
    system_prompt = "You are a senior code reviewer evaluating a candidate's coding round."
    prompt = f"""
    Evaluate the CODING ROUND performance for a {position} role.

    Problem: {problem.get('title', 'Coding Problem')}
    Language used: {language}
    Tests passed: {passed_tests}/{total_tests}
    Attempts used: {attempts}

    Candidate's code:
    ```{language}
    {code}
    ```

    Evaluate based on:
    - Code correctness (tests passed)
    - Code quality and readability
    - Time complexity
    - Problem-solving approach

    Return STRICT JSON:
    {{
        "score": <number 0-100>,
        "correctness": <number 0-100>,
        "code_quality": <number 0-100>,
        "efficiency": <number 0-100>,
        "approach": <number 0-100>,
        "feedback": "Detailed paragraph of feedback",
        "strengths": ["...", "..."],
        "weaknesses": ["...", "..."]
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no comments.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )
        result = safe_json_parse(response)
        if result is None:
            raise ValueError("Failed to parse coding evaluation JSON")
        return result
    except Exception as e:
        logger.error("Coding evaluation error: %s", sanitize_for_logging(str(e)))
        # Score based on test results
        base_score = int((passed_tests / max(total_tests, 1)) * 100)
        return {"score": base_score, "correctness": base_score, "code_quality": 50,
                "efficiency": 50, "approach": 50,
                "feedback": f"Passed {passed_tests}/{total_tests} tests.", "strengths": [], "weaknesses": []}


# ═══════════════════════════════════════════
# STAGE 4 — HR / Behavioral Interview
# ═══════════════════════════════════════════

async def generate_hr_question(
    position: str,
    history: List[Dict[str, Any]],
) -> str:
    """Generate HR/behavioral interview questions."""
    system_prompt = f"""
    You are an experienced HR interviewer conducting the BEHAVIORAL/HR INTERVIEW for a {position} role.

    Generate a behavioral interview question from these categories:
    - Self-introduction and motivation
    - Strengths and weaknesses
    - Career goals and aspirations
    - Conflict resolution and teamwork
    - Leadership and adaptability
    - Work-life balance and cultural fit

    The question should assess:
    - Communication skills
    - Emotional intelligence
    - Cultural fit
    - Self-awareness
    - Confidence

    Follow naturally from previous conversation.

    IMPORTANT: Return ONLY the question text. No introductory phrases, numbering, or formatting.
    """

    messages = []
    for entry in history:
        messages.append({"role": "assistant", "content": entry["question"]})
        messages.append({"role": "user", "content": entry["answer"]})

    return await ai_hub.chat_completion(messages, system_prompt)


async def evaluate_hr(
    position: str,
    responses: List[Dict[str, Any]],
) -> dict:
    """Evaluate HR/behavioral interview performance."""
    system_prompt = "You are a senior HR panel evaluating a candidate's behavioral interview."
    prompt = f"""
    Evaluate the HR / BEHAVIORAL INTERVIEW performance for a {position} role.

    Candidate's Q&A:
    {json.dumps(responses, indent=2)}

    Evaluate based on:
    - Communication skills
    - Clarity of expression
    - Confidence level
    - Emotional intelligence
    - Cultural fit

    Return STRICT JSON:
    {{
        "score": <number 0-100>,
        "communication": <number 0-100>,
        "clarity": <number 0-100>,
        "confidence": <number 0-100>,
        "emotional_intelligence": <number 0-100>,
        "feedback": "Detailed paragraph of feedback",
        "strengths": ["...", "..."],
        "weaknesses": ["...", "..."]
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no comments.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )
        result = safe_json_parse(response)
        if result is None:
            raise ValueError("Failed to parse HR evaluation JSON")
        return result
    except Exception as e:
        logger.error("HR evaluation error: %s", sanitize_for_logging(str(e)))
        return {"score": 50, "communication": 50, "clarity": 50,
                "confidence": 50, "emotional_intelligence": 50,
                "feedback": "Evaluation completed.", "strengths": [], "weaknesses": []}


# ═══════════════════════════════════════════
# FINAL — Overall Analysis
# ═══════════════════════════════════════════

async def generate_final_analysis(
    position: str,
    screening_eval: dict,
    technical_eval: dict,
    coding_eval: dict,
    hr_eval: dict,
) -> dict:
    """Generate comprehensive final analysis across all stages."""
    system_prompt = "You are the final hiring committee producing a comprehensive interview verdict."
    prompt = f"""
    A candidate has completed all 4 stages of the interview process for a {position} role.

    Stage Results:
    1. Application Screening Score: {screening_eval.get('score', 0)}/100
    2. Technical Interview Score: {technical_eval.get('score', 0)}/100
    3. Coding Round Score: {coding_eval.get('score', 0)}/100
    4. HR Interview Score: {hr_eval.get('score', 0)}/100

    Stage Feedback:
    - Screening: {screening_eval.get('feedback', '')}
    - Technical: {technical_eval.get('feedback', '')}
    - Coding: {coding_eval.get('feedback', '')}
    - HR: {hr_eval.get('feedback', '')}

    Generate a comprehensive final interview verdict.

    Return STRICT JSON:
    {{
        "overall_score": <weighted average 0-100>,
        "verdict": "Strong Hire" | "Hire" | "Maybe" | "No Hire",
        "strengths": ["top 3-5 key strengths across all rounds"],
        "weaknesses": ["top 3-5 areas for improvement"],
        "overall_feedback": "Comprehensive hiring committee paragraph",
        "improvement_tips": ["actionable tip 1", "actionable tip 2", "actionable tip 3"],
        "hire_probability": <number 0-100>
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no comments.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )
        result = safe_json_parse(response)
        if result is None:
            raise ValueError("Failed to parse final analysis JSON")
        return result
    except Exception as e:
        logger.error("Final analysis error: %s", sanitize_for_logging(str(e)))
        avg = (
            screening_eval.get('score', 0) +
            technical_eval.get('score', 0) +
            coding_eval.get('score', 0) +
            hr_eval.get('score', 0)
        ) / 4
        return {
            "overall_score": round(avg),
            "verdict": "Hire" if avg >= 60 else "No Hire",
            "strengths": [],
            "weaknesses": [],
            "overall_feedback": "Interview evaluation complete.",
            "improvement_tips": [],
            "hire_probability": round(avg)
        }


# ═══════════════════════════════════════════
# DB Operations
# ═══════════════════════════════════════════

def create_interview_session(
    user_id: str,
    position: str,
    interview_mode: str,
    difficulty: str,
    db: Session,
) -> dict:
    """Create a new multi-stage interview session with safe DB handling."""
    try:
        session = MultiStageInterview(
            user_id=user_id,
            position=position,
            interview_mode=interview_mode,
            difficulty=difficulty,
            current_stage="screening",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"id": str(session.id), "position": position, "current_stage": "screening"}
    except Exception as e:
        db.rollback()
        logger.error("Failed to create interview session: %s", str(e))
        raise


def update_stage_result(
    session_id: str,
    user_id: str,
    stage: str,
    score: float,
    stage_data: dict,
    db: Session,
) -> dict:
    """Update a specific stage result."""
    session = db.query(MultiStageInterview).filter(
        MultiStageInterview.id == session_id,
        MultiStageInterview.user_id == user_id
    ).first()

    if not session:
        return {"error": "Session not found"}

    stage_map = {
        "screening": ("screening_score", "screening_data", "technical"),
        "technical": ("technical_score", "technical_data", "coding"),
        "coding": ("coding_score", "coding_data", "hr"),
        "hr": ("hr_score", "hr_data", "completed"),
    }

    if stage not in stage_map:
        return {"error": f"Invalid stage: {stage}"}

    score_col, data_col, next_stage = stage_map[stage]
    setattr(session, score_col, score)
    setattr(session, data_col, stage_data)
    session.current_stage = next_stage

    if next_stage == "completed":
        session.is_completed = True
        session.completed_at = datetime.now(timezone.utc)
        # Calculate overall
        scores = [
            session.screening_score or 0,
            session.technical_score or 0,
            session.coding_score or 0,
            session.hr_score or 0,
        ]
        session.overall_score = round(sum(scores) / len(scores), 1)

    db.commit()
    db.refresh(session)

    return {
        "id": str(session.id),
        "current_stage": session.current_stage,
        "is_completed": session.is_completed,
    }


def save_final_results(
    session_id: str,
    user_id: str,
    final_analysis: dict,
    db: Session,
) -> dict:
    """Save final analysis results."""
    session = db.query(MultiStageInterview).filter(
        MultiStageInterview.id == session_id,
        MultiStageInterview.user_id == user_id
    ).first()

    if not session:
        return {"error": "Session not found"}

    session.overall_score = final_analysis.get("overall_score", session.overall_score)
    session.strengths = final_analysis.get("strengths", [])
    session.weaknesses = final_analysis.get("weaknesses", [])
    session.overall_feedback = final_analysis.get("overall_feedback", "")
    session.verdict = final_analysis.get("verdict", "")

    db.commit()
    db.refresh(session)

    return {
        "id": str(session.id),
        "overall_score": session.overall_score,
        "verdict": session.verdict,
    }


def get_multistage_history(user_id: str, db: Session) -> List[dict]:
    """Get all multi-stage interview sessions for a user."""
    sessions = db.query(MultiStageInterview).filter(
        MultiStageInterview.user_id == user_id
    ).order_by(MultiStageInterview.created_at.desc()).all()

    return [
        {
            "id": str(s.id),
            "position": s.position,
            "interview_mode": s.interview_mode,
            "difficulty": s.difficulty,
            "screening_score": s.screening_score,
            "technical_score": s.technical_score,
            "coding_score": s.coding_score,
            "hr_score": s.hr_score,
            "overall_score": s.overall_score,
            "verdict": s.verdict,
            "strengths": s.strengths,
            "weaknesses": s.weaknesses,
            "overall_feedback": s.overall_feedback,
            "current_stage": s.current_stage,
            "is_completed": s.is_completed,
            "created_at": str(s.created_at),
            "completed_at": str(s.completed_at) if s.completed_at else None,
        }
        for s in sessions
    ]


def _clean_json(text: str) -> str:
    """Clean AI response to extract valid JSON. Kept for backward compat."""
    clean = (text or "").strip()
    if "```json" in clean:
        try:
            clean = clean.split("```json")[1].split("```")[0].strip()
        except (IndexError, ValueError):
            pass
    elif "```" in clean:
        try:
            clean = clean.split("```")[1].split("```")[0].strip()
        except (IndexError, ValueError):
            pass
    return clean
