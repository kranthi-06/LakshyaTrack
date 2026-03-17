"""
Resume Service — PDF text extraction and AI-powered analysis.
Production-grade with:
- Safe PDF parsing (handles corrupt files)
- Robust AI JSON response extraction
- Input size protection
- Graceful fallback on any failure
"""
import io
import json
import logging
import hashlib
from typing import Optional

from app.core.resilience import safe_json_parse, sanitize_for_logging
from app.services.ai_service import ai_hub
from app.services import document_store_service

logger = logging.getLogger(__name__)

# Limits
MAX_RESUME_TEXT_LENGTH = 5000  # Characters sent to AI
MAX_JOB_DESC_LENGTH = 3000    # Characters sent to AI
MAX_PDF_PAGES = 50            # Safety cap


async def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extract text from PDF bytes.
    Handles corrupt PDFs, empty pages, and oversized documents safely.
    """
    if not file_content:
        raise ValueError("Empty file content")

    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_content))
        text_parts = []

        page_count = min(len(reader.pages), MAX_PDF_PAGES)
        for i in range(page_count):
            try:
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text_parts.append(page_text)
            except Exception as page_err:
                logger.warning("Failed to extract text from page %d: %s", i + 1, str(page_err))
                continue

        text = "\n".join(text_parts)

        if not text.strip():
            raise ValueError("No readable text found in PDF. The file may be image-based or protected.")

        return text

    except ValueError:
        raise  # Re-raise our own validation errors
    except Exception as e:
        logger.error("PDF extraction failed: %s", sanitize_for_logging(str(e)))
        raise ValueError(f"Could not read PDF file: {str(e)}")


async def analyze_resume_with_ai(
    resume_text: str,
    job_description: str = "",
) -> dict:
    """
    Analyze resume text using AI with robust JSON extraction.
    Never crashes — always returns a valid result dict.
    """
    if not resume_text or not resume_text.strip():
        return _error_response("No resume text provided")

    # Truncate inputs for safety
    safe_resume = resume_text[:MAX_RESUME_TEXT_LENGTH]
    safe_jd = job_description[:MAX_JOB_DESC_LENGTH] if job_description else ""

    # MongoDB Atlas caching (behavior-preserving): same inputs → same output.
    # If MongoDB is not configured, this is a no-op.
    try:
        cache_payload = {
            "type": "resume_analysis_v1",
            "resume": safe_resume,
            "job_description": safe_jd,
        }
        cache_key = hashlib.sha256(
            json.dumps(cache_payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()
        cached = document_store_service.get_ai_cache(cache_key)
        if cached and isinstance(cached.get("response"), dict):
            logger.info("Resume analysis cache hit")
            return cached["response"]
    except Exception:
        cache_key = None

    system_prompt = "You are a world-class AI Career Consultant and Resume Strategist."

    if safe_jd:
        prompt = f"""
        Analyze the following resume against the job description provided. 
        Provide a highly detailed, professional analysis in JSON format.
        
        Job Description:
        {safe_jd}
        
        Resume Text:
        {safe_resume}
        
        The JSON output must have exactly these keys:
        1. "ats_score": Integer (0-100) based on compatibility.
        2. "keyword_analysis": {{
            "matched": [list of skills found in both],
            "missing": [list of critical skills in JD but missing in resume],
            "extra": [list of valuable skills in resume but not required by JD]
        }}
        3. "industry_fit": {{
            "score": Integer (0-100),
            "verdict": "A brief 2-sentence professional assessment of the alignment.",
            "top_industries": [list of 3 industries this profile aligns with]
        }}
        4. "strengths": [list of 3-5 key professional strengths],
        5. "weaknesses": [list of 3-5 areas for improvement],
        6. "improvement_plan": [list of 3 actionable steps to improve the resume for this role]

        IMPORTANT: Return ONLY valid JSON. No markdown, no conversational text.
        """
    else:
        prompt = f"""
        Analyze the following resume text and provide a comprehensive professional assessment in JSON format.
        IMPORTANT: Return ONLY the valid JSON object. Do not use markdown keys or conversational text.
        
        Resume Text:
        {safe_resume}
        
        The JSON output must have exactly these keys:
        1. "ats_score": Integer (0-100) based on formatting and content quality.
        2. "keyword_analysis": {{
            "matched": [list of detected technical and soft skills],
            "missing": ["N/A - Provide a job description for gap analysis"],
            "extra": []
        }}
        3. "industry_fit": {{
            "score": Integer (0-100),
            "verdict": "A brief professional summary of the user's career profile.",
            "top_industries": [list of 3 industries this profile aligns with]
        }}
        4. "strengths": [list of 3-5 key professional strengths],
        5. "weaknesses": [list of 3-5 areas for improvement],
        6. "improvement_plan": [list of 3 actionable tips for general resume optimization]

        IMPORTANT: Return ONLY valid JSON. No markdown, no conversational text.
        """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt,
        )

        logger.info("AI resume analysis response length: %d", len(response) if response else 0)

        # Use production-grade JSON parser with multi-strategy extraction
        result = safe_json_parse(response)

        if result is not None and isinstance(result, dict):
            if cache_key:
                document_store_service.set_ai_cache(
                    cache_key=cache_key,
                    response=result,
                    provider="ai_hub",
                    input_payload={"resume": safe_resume, "job_description": safe_jd},
                    metadata={"type": "resume_analysis_v1"},
                )
            return result

        # If safe_json_parse returned None, log and return structured error
        logger.warning(
            "AI returned unparseable response for resume analysis. Snippet: %s",
            sanitize_for_logging(response or "EMPTY"),
        )
        return _error_response(
            f"AI response was not valid JSON. Snippet: {sanitize_for_logging(response or 'EMPTY', max_length=200)}"
        )

    except Exception as e:
        logger.error("Resume analysis failed: %s", sanitize_for_logging(str(e)))
        error = _error_response(str(e))
        if cache_key:
            # Cache error responses briefly so traffic spikes don't DDOS AI providers.
            # Still behavior-preserving: repeated identical failures would have returned the same error anyway.
            document_store_service.set_ai_cache(
                cache_key=cache_key,
                response=error,
                provider="error",
                input_payload={"resume": safe_resume, "job_description": safe_jd},
                metadata={"type": "resume_analysis_v1", "error": True},
            )
        return error


def _error_response(error_message: str) -> dict:
    """
    Return a structured error response that the frontend can display.
    This ensures the API never returns malformed data.
    """
    return {
        "ats_score": 0,
        "keyword_analysis": {
            "matched": ["ANALYSIS UNAVAILABLE"],
            "missing": [f"Error: {error_message[:300]}"],
            "extra": [],
        },
        "industry_fit": {
            "score": 0,
            "verdict": f"Resume analysis encountered an error: {error_message[:300]}. Please retry.",
            "top_industries": ["System Status"],
        },
        "strengths": ["System is online", "Error captured for debugging"],
        "weaknesses": ["AI analysis could not complete", "See verdict for details"],
        "improvement_plan": ["Retry the analysis", "Check the resume format", "Report this if it persists"],
    }
