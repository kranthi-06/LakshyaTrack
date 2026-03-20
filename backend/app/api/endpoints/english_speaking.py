"""
English Speaking Analysis API — Passage-Based AI Speaking Trainer
Generates passages, analyzes spoken text for accuracy/fluency, and provides
AI-powered personalized feedback.
"""
import json
import logging
import random
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_service import ai_hub

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════

class SpeakingAnalysisRequest(BaseModel):
    type: str = Field(..., description="'sentence' for passage comparison, 'topic' for free speaking, 'interview' for interview sim")
    original_text: Optional[str] = Field(None, description="Original passage / question text")
    user_text: str = Field(..., description="User's spoken text")


class SpeakingAnalysisResponse(BaseModel):
    analysis: dict


class GeneratePassageRequest(BaseModel):
    difficulty: str = Field("easy", description="easy | medium | hard")
    category: str = Field("general", description="interview | college | daily_life | technology | general")


class GeneratePassageResponse(BaseModel):
    passage: str
    category: str
    difficulty: str


class GenerateTopicResponse(BaseModel):
    topic: str
    sample_passage: str


# ═══════════════════════════════════════════════════════════════
# FALLBACK PASSAGES (used when AI is unavailable)
# ═══════════════════════════════════════════════════════════════

FALLBACK_PASSAGES = {
    "interview": [
        "I am currently pursuing my degree in computer science. I have worked on several projects during my college years. My strongest skills include problem solving and teamwork. I am confident that I can contribute positively to your organization. I am eager to learn and grow in a professional environment.",
        "I believe communication is the key to success in any workplace. During my internship, I learned to collaborate with team members effectively. I always try to understand the requirements before starting any task. I am passionate about technology and enjoy building useful applications. I look forward to applying my skills in a real-world setting.",
        "My name is a student preparing for campus placements. I have good knowledge of data structures and algorithms. I have built a web application as my final year project. I enjoy working in teams and solving challenging problems. I am ready to take on new responsibilities and grow as a professional.",
    ],
    "college": [
        "College life is an important phase for every student. It helps us develop both academic and social skills. We learn to manage our time between studies and activities. Group projects teach us the value of teamwork and communication. These experiences prepare us for the challenges of professional life.",
        "My college has given me many opportunities to grow. I participated in coding competitions and hackathons. I also joined the technical club where I learned new programming languages. The professors always encouraged us to think creatively. I am grateful for the education and experiences I received.",
        "Studying in college requires discipline and dedication. Every day brings new challenges and learning opportunities. I try to balance my academics with extracurricular activities. Reading books and attending workshops has helped me improve my knowledge. I believe education is the foundation for a successful career.",
    ],
    "daily_life": [
        "Every morning I wake up early and start my day with exercise. After breakfast I review my study notes and plan my tasks. I spend a few hours coding and working on my projects. In the evening I like to read articles about new technologies. A good daily routine helps me stay productive and focused.",
        "Time management is very important in our daily lives. I use a planner to organize my tasks and set priorities. I make sure to take short breaks between study sessions. Eating healthy food and getting enough sleep keeps me energized. Small habits like these make a big difference over time.",
        "I believe in starting each day with a positive mindset. I set small goals and try to achieve them before the day ends. Communication with friends and family keeps me motivated. I also practice English by reading newspapers and watching videos. A well-organized day leads to a more productive and happy life.",
    ],
    "technology": [
        "Technology has changed the way we live and work today. Artificial intelligence is being used in many fields like healthcare and education. Mobile applications have made our daily tasks much easier and faster. Cloud computing allows companies to store and process large amounts of data. It is important for students to stay updated with the latest technology trends.",
        "Programming is an essential skill in the modern world. Languages like Python and JavaScript are widely used in the industry. Building projects helps us understand how software works in practice. Open source communities allow developers to learn and contribute together. Technology continues to create new opportunities for students and professionals.",
    ],
    "general": [
        "Reading is one of the best habits a person can develop. It improves vocabulary, understanding, and communication skills. Even fifteen minutes of reading every day can make a big difference. Books open our minds to new ideas and different perspectives. Reading regularly also helps us become better writers and speakers.",
        "Good communication skills are essential in today's world. Whether in personal life or at work, clear communication builds trust. Listening carefully is just as important as speaking clearly. Using simple words and short sentences makes our message easier to understand. Practicing communication daily helps us become more confident speakers.",
    ],
}

FALLBACK_TOPICS = [
    {"topic": "Describe your final year project and the technologies you used.", "sample_passage": "My final year project is a web application built using React and Node.js. It helps students track their learning progress and prepare for placement interviews. I chose this project because I wanted to solve a real-world problem. The application uses a database to store user data and provides personalized recommendations. Working on this project taught me many valuable skills including teamwork and time management."},
    {"topic": "Talk about a skill you recently learned and how it has helped you.", "sample_passage": "Recently I learned how to use Python for data analysis. I started by watching online tutorials and practicing with small datasets. This skill has helped me understand how data drives decisions in business. I also used it in my college project to analyze student performance data. Learning new skills regularly keeps me motivated and prepared for the future."},
    {"topic": "What motivates you to work hard every day?", "sample_passage": "My family and my goals motivate me to work hard every day. I want to build a successful career in technology and make my parents proud. I also find motivation in learning new things and solving challenging problems. Setting small daily goals helps me stay focused and productive. I believe consistent effort is the key to achieving long-term success."},
    {"topic": "Describe your ideal work environment.", "sample_passage": "My ideal work environment is one that encourages learning and collaboration. I prefer working in a team where everyone supports each other. A good workplace should have a positive culture and opportunities for growth. I also value work-life balance and a comfortable working space. I believe the best results come when people enjoy what they do."},
    {"topic": "Talk about the importance of teamwork in college and career.", "sample_passage": "Teamwork is one of the most important skills for both college and career success. In college, group projects teach us how to share responsibilities and communicate effectively. Working in a team helps us learn from others and see different perspectives. In the workplace, teamwork leads to better problem solving and faster results. I always try to be a supportive and reliable team member."},
    {"topic": "Explain how technology has changed education in recent years.", "sample_passage": "Technology has completely transformed the way we learn and teach. Online platforms provide access to courses from top universities around the world. Students can now learn at their own pace using video lectures and interactive tools. Digital resources have made education more affordable and accessible to everyone. I believe technology will continue to improve the quality of education in the future."},
]


# ═══════════════════════════════════════════════════════════════
# AI PROMPT BUILDERS
# ═══════════════════════════════════════════════════════════════

def _build_passage_prompt(original: str, spoken: str) -> str:
    return f"""You are an expert English communication coach analyzing a student's spoken English.

The student was asked to read aloud the following passage:
--- ORIGINAL PASSAGE ---
{original}
--- END ORIGINAL ---

The student spoke:
--- SPOKEN TEXT ---
{spoken}
--- END SPOKEN ---

Analyze the student's speech comprehensively and return a JSON object with EXACTLY this structure (no markdown, no extra text):
{{
  "accuracy": <number 0-100>,
  "missing_words": [<list of significant words in original but missing from spoken text, max 10>],
  "incorrect_words": [<list of words spoken incorrectly or significantly changed, max 10>],
  "fluency": "<Excellent | Good | Average | Needs Improvement>",
  "confidence": "<High | Medium | Low>",
  "issues": [<2-4 specific issues observed, e.g. "Skipped entire second sentence", "Mixed up word order in third sentence">],
  "tips": [<3-5 specific, actionable, encouraging tips as strings>]
}}

Rules:
- Compare words case-insensitively
- accuracy = percentage of original passage words correctly spoken, rounded to integer
- Only list truly missing/incorrect words, not minor variations
- fluency considers whether the passage was read smoothly without too many pauses
- confidence is estimated from how much of the passage was attempted
- issues should describe specific problems (not generic feedback)
- Tips should be encouraging, practical, and personalized
- Return ONLY valid JSON, nothing else"""


def _build_topic_prompt(user_text: str, topic: str = "") -> str:
    topic_ctx = ""
    if topic:
        topic_ctx = f'\nThe speaking topic was: "{topic}"\n'
    
    return f"""You are an expert English communication coach evaluating a student's free-form speaking skills.
{topic_ctx}
The student spoke freely. Here is their transcribed speech:
"{user_text}"

Analyze the student's communication and return a JSON object with EXACTLY this structure (no markdown, no extra text):
{{
  "fluency": "<Excellent | Good | Average | Needs Improvement>",
  "vocabulary": "<Advanced | Intermediate | Basic | Limited>",
  "sentence_structure": "<Excellent | Good | Needs Improvement | Poor>",
  "grammar": "<Excellent | Good | Basic errors | Many errors>",
  "confidence": "<High | Medium | Low>",
  "issues": [<2-4 specific issues, e.g. "Repeatedly used the word 'like' as filler", "Sentences lack connectors">],
  "tips": [<3-5 specific actionable tips as strings>],
  "improved_answer": "<A polished, improved version of what the student said, keeping the same meaning but with better grammar, vocabulary, and structure. Should be 3-5 sentences long.>"
}}

Rules:
- Be encouraging but honest
- confidence is estimated from length and coherence of speech
- improved_answer should be natural and conversational, not overly formal
- issues should pinpoint specific problems in what the student said
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
  "issues": [<2-4 specific issues in the interview response>],
  "tips": [<3-5 specific actionable tips as strings>],
  "improved_answer": "<A polished, improved version of the student's response that would impress an interviewer. 3-5 sentences.>"
}}

Rules:
- Evaluate as if this is an actual placement interview
- Be encouraging but realistic
- improved_answer should sound natural and professional
- Tips should be specific to interview performance
- Return ONLY valid JSON, nothing else"""


def _build_generate_passage_prompt(category: str, difficulty: str) -> str:
    difficulty_guide = {
        "easy": "Use very simple words and short sentences. Vocabulary should be basic (A1-A2 level).",
        "medium": "Use moderately complex sentences with some connectors. Vocabulary should be intermediate (B1 level).",
        "hard": "Use well-constructed sentences with advanced connectors and richer vocabulary (B2 level).",
    }
    diff_instruction = difficulty_guide.get(difficulty, difficulty_guide["easy"])

    return f"""Generate a short English passage for a student to practice reading aloud.

Requirements:
- Exactly 3 to 5 sentences
- Topic category: {category} (related to placement preparation, college life, or daily activities)
- {diff_instruction}
- The passage should be natural, encouraging, and relevant to a college student preparing for placements
- Each sentence should flow naturally into the next

Return ONLY the passage text, nothing else. No quotes, no labels, no formatting."""


def _build_generate_topic_prompt() -> str:
    return """Generate a speaking practice topic for a college student preparing for placement interviews.

Return a JSON object with EXACTLY this structure (no markdown, no extra text):
{
  "topic": "<A clear, specific topic question for the student to speak about, one sentence>",
  "sample_passage": "<A 3-5 sentence sample answer that demonstrates good English speaking, using simple and clear language>"
}

The topic should be related to one of: college life, career goals, technology, daily routine, personal growth, teamwork, or interview preparation.

Return ONLY valid JSON, nothing else."""


def _safe_parse_json(text: str) -> dict:
    """Try to parse JSON from AI response, handling markdown code blocks."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass
    
    return {
        "error": "Could not parse AI response",
        "raw_response": text[:500]
    }


# ═══════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post("/generate-passage", response_model=GeneratePassageResponse)
async def generate_passage(request: GeneratePassageRequest):
    """Generate an AI passage for the Read & Speak module."""
    category = request.category if request.category in FALLBACK_PASSAGES else "general"
    difficulty = request.difficulty if request.difficulty in ("easy", "medium", "hard") else "easy"

    try:
        prompt = _build_generate_passage_prompt(category, difficulty)
        response = await ai_hub.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a helpful English teacher. Generate only the passage text. No JSON, no markdown.",
        )
        passage = response.strip().strip('"').strip("'")
        if len(passage) < 30:
            raise ValueError("AI returned too short a passage")
        return GeneratePassageResponse(passage=passage, category=category, difficulty=difficulty)

    except Exception as e:
        logger.warning("Passage generation failed, using fallback: %s", str(e))
        pool = FALLBACK_PASSAGES.get(category, FALLBACK_PASSAGES["general"])
        return GeneratePassageResponse(
            passage=random.choice(pool),
            category=category,
            difficulty=difficulty,
        )


@router.post("/generate-topic", response_model=GenerateTopicResponse)
async def generate_topic():
    """Generate an AI practice topic with a sample passage."""
    try:
        prompt = _build_generate_topic_prompt()
        response = await ai_hub.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a helpful English teacher. Always respond with valid JSON only.",
        )
        parsed = _safe_parse_json(response)
        if "topic" in parsed and "sample_passage" in parsed:
            return GenerateTopicResponse(topic=parsed["topic"], sample_passage=parsed["sample_passage"])
        raise ValueError("AI response missing required fields")

    except Exception as e:
        logger.warning("Topic generation failed, using fallback: %s", str(e))
        fallback = random.choice(FALLBACK_TOPICS)
        return GenerateTopicResponse(topic=fallback["topic"], sample_passage=fallback["sample_passage"])


@router.post("/analyze-speaking", response_model=SpeakingAnalysisResponse)
async def analyze_speaking(request: SpeakingAnalysisRequest):
    """
    Analyze user's spoken English using AI.
    
    Supports three modes:
    - sentence: Compare spoken text against original passage
    - topic: Evaluate free-form speaking on a topic
    - interview: Evaluate interview response
    """
    try:
        if request.type == "sentence":
            if not request.original_text:
                raise HTTPException(status_code=400, detail="original_text is required for sentence mode")
            prompt = _build_passage_prompt(request.original_text, request.user_text)
        elif request.type == "topic":
            prompt = _build_topic_prompt(request.user_text, request.original_text or "")
        elif request.type == "interview":
            prompt = _build_interview_prompt(request.user_text, request.original_text)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid type: {request.type}. Must be 'sentence', 'topic', or 'interview'")

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
        if request.type == "sentence":
            fallback = {
                "accuracy": 0, "missing_words": [], "incorrect_words": [],
                "fluency": "Unable to analyze", "confidence": "Unable to analyze",
                "issues": ["AI service temporarily unavailable"],
                "tips": ["Please try again — the AI service is temporarily unavailable."],
            }
        else:
            fallback = {
                "fluency": "Unable to analyze", "vocabulary": "Unable to analyze",
                "sentence_structure": "Unable to analyze", "grammar": "Unable to analyze",
                "confidence": "Unable to analyze",
                "issues": ["AI service temporarily unavailable"],
                "tips": ["Please try again — the AI service is temporarily unavailable."],
                "improved_answer": request.user_text,
            }
        return SpeakingAnalysisResponse(analysis=fallback)
