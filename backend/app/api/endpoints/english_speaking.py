"""
English Speaking Analysis API
Analyzes user's spoken text for accuracy, fluency, and provides AI-powered feedback.
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_service import ai_hub

logger = logging.getLogger(__name__)
router = APIRouter()


class SpeakingAnalysisRequest(BaseModel):
    type: str = Field(..., description="'sentence' for read-and-speak, 'topic' for free speaking, 'interview' for interview sim")
    original_text: Optional[str] = Field(None, description="Original sentence (only for sentence mode)")
    user_text: str = Field(..., description="User's spoken text")


class SpeakingAnalysisResponse(BaseModel):
    analysis: dict


def _build_sentence_prompt(original: str, spoken: str) -> str:
    return f"""You are an expert English communication coach analyzing a student's spoken English.

The student was asked to read aloud the following sentence:
ORIGINAL: "{original}"

The student spoke:
SPOKEN: "{spoken}"

Analyze the student's speech and return a JSON object with EXACTLY this structure (no markdown, no extra text):
{{
  "accuracy": <number 0-100>,
  "missing_words": [<list of words in original but not spoken>],
  "incorrect_words": [<list of words spoken incorrectly or extra words>],
  "fluency": "<Excellent | Good | Average | Needs Improvement>",
  "tips": [<3-5 specific actionable tips as strings>]
}}

Rules:
- Compare words case-insensitively
- accuracy = (matched words / total words in original) * 100, rounded to integer
- If user spoke perfectly, accuracy should be 100
- Tips should be encouraging and practical
- Return ONLY valid JSON, nothing else"""


def _build_topic_prompt(user_text: str) -> str:
    return f"""You are an expert English communication coach evaluating a student's free-form speaking skills.

The student spoke freely on a topic. Here is their transcribed speech:
"{user_text}"

Analyze the student's communication and return a JSON object with EXACTLY this structure (no markdown, no extra text):
{{
  "fluency": "<Excellent | Good | Average | Needs Improvement>",
  "vocabulary": "<Advanced | Intermediate | Basic | Limited>",
  "sentence_structure": "<Excellent | Good | Needs Improvement | Poor>",
  "grammar": "<Excellent | Good | Basic errors | Many errors>",
  "confidence": "<High | Medium | Low>",
  "tips": [<3-5 specific actionable tips as strings>],
  "improved_answer": "<A polished, improved version of what the student said, keeping the same meaning but with better grammar, vocabulary, and structure>"
}}

Rules:
- Be encouraging but honest
- confidence is estimated from length and coherence of speech
- improved_answer should be natural and conversational, not overly formal
- Tips should be practical and specific to what the student said
- Return ONLY valid JSON, nothing else"""


def _build_interview_prompt(user_text: str, question: Optional[str] = None) -> str:
    context = ""
    if question:
        context = f'\nThe interview question was: "{question}"\n'
    
    return f"""You are an expert HR interview coach evaluating a student's interview response.
{context}
The student's response:
"{user_text}"

Analyze the student's interview response and return a JSON object with EXACTLY this structure (no markdown, no extra text):
{{
  "fluency": "<Excellent | Good | Average | Needs Improvement>",
  "vocabulary": "<Advanced | Intermediate | Basic | Limited>",
  "sentence_structure": "<Excellent | Good | Needs Improvement | Poor>",
  "grammar": "<Excellent | Good | Basic errors | Many errors>",
  "confidence": "<High | Medium | Low>",
  "relevance": "<Highly Relevant | Relevant | Partially Relevant | Off Topic>",
  "tips": [<3-5 specific actionable tips as strings>],
  "improved_answer": "<A polished, improved version of the student's response that would impress an interviewer>"
}}

Rules:
- Evaluate as if this is an actual placement interview
- Be encouraging but realistic
- improved_answer should sound natural and professional
- Tips should be specific to interview performance
- Return ONLY valid JSON, nothing else"""


def _safe_parse_json(text: str) -> dict:
    """Try to parse JSON from AI response, handling markdown code blocks."""
    cleaned = text.strip()
    # Remove markdown code fences
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass
    
    # Return a fallback
    return {
        "error": "Could not parse AI response",
        "raw_response": text[:500]
    }


@router.post("/analyze-speaking", response_model=SpeakingAnalysisResponse)
async def analyze_speaking(request: SpeakingAnalysisRequest):
    """
    Analyze user's spoken English using AI.
    
    Supports three modes:
    - sentence: Compare spoken text against original sentence
    - topic: Evaluate free-form speaking on a topic
    - interview: Evaluate interview response
    """
    try:
        if request.type == "sentence":
            if not request.original_text:
                raise HTTPException(
                    status_code=400,
                    detail="original_text is required for sentence mode"
                )
            prompt = _build_sentence_prompt(request.original_text, request.user_text)
        elif request.type == "topic":
            prompt = _build_topic_prompt(request.user_text)
        elif request.type == "interview":
            prompt = _build_interview_prompt(request.user_text, request.original_text)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid type: {request.type}. Must be 'sentence', 'topic', or 'interview'"
            )

        system_prompt = "You are an expert English communication coach. Always respond with valid JSON only, no markdown formatting."
        
        response = await ai_hub.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
        )

        analysis = _safe_parse_json(response)
        
        return SpeakingAnalysisResponse(analysis=analysis)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("English speaking analysis failed: %s", str(e))
        # Return a basic fallback analysis
        if request.type == "sentence":
            fallback = {
                "accuracy": 0,
                "missing_words": [],
                "incorrect_words": [],
                "fluency": "Unable to analyze",
                "tips": ["Please try again — the AI service is temporarily unavailable."]
            }
        else:
            fallback = {
                "fluency": "Unable to analyze",
                "vocabulary": "Unable to analyze",
                "sentence_structure": "Unable to analyze",
                "grammar": "Unable to analyze",
                "confidence": "Unable to analyze",
                "tips": ["Please try again — the AI service is temporarily unavailable."],
                "improved_answer": request.user_text
            }
        return SpeakingAnalysisResponse(analysis=fallback)
