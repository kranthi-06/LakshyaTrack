from fastapi import APIRouter
from app.api.endpoints import (
    auth, users, resume, career, learning, interview, quiz, resume_builder, media,
    # New advanced modules
    roadmap, quiz_gating, learning_content, interview_advanced,
    opportunities, progress,
    saved_resumes,
    # Admin system
    admin,
    # Exam proctoring
    exam,
    # Multi-stage interview system
    interview_multistage,
    # Code execution engine
    code_execution,
    # Subscription system
    subscription,
    # English communication module
    english_speaking,
    # Reasoning & Problem Solving module
    reasoning,
)

api_router = APIRouter()

# ── Existing routes (UNCHANGED) ──────────────────────────
api_router.include_router(auth.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(resume.router, prefix="/resume", tags=["resume"])
api_router.include_router(resume_builder.router, prefix="/resume-builder", tags=["resume-builder"])
api_router.include_router(career.router, prefix="/career", tags=["career"])
api_router.include_router(learning.router, prefix="/learning", tags=["learning"])
api_router.include_router(interview.router, prefix="/interview", tags=["interview"])
api_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])

# ── New advanced modules ─────────────────────────────────
api_router.include_router(roadmap.router, prefix="/roadmap", tags=["roadmap"])
api_router.include_router(quiz_gating.router, prefix="/quiz-gating", tags=["quiz-gating"])
api_router.include_router(learning_content.router, prefix="/learning-content", tags=["learning-content"])
api_router.include_router(interview_advanced.router, prefix="/interview-advanced", tags=["interview-advanced"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["opportunities"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(saved_resumes.router, prefix="/saved-resumes", tags=["saved-resumes"])
api_router.include_router(exam.router, prefix="/exam", tags=["exam"])
api_router.include_router(interview_multistage.router, prefix="/interview-multistage", tags=["interview-multistage"])

# ── Admin system ─────────────────────────────────────────
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# ── Code Execution Engine ────────────────────────────────
api_router.include_router(code_execution.router, prefix="/code-execution", tags=["code-execution"])

# ── Subscription & Feature Access ────────────────────────
api_router.include_router(subscription.router, prefix="/subscription", tags=["subscription"])

# ── English Communication Module ─────────────────────────
api_router.include_router(english_speaking.router, prefix="/english", tags=["english-speaking"])

# ── Reasoning & Problem Solving ──────────────────────────
api_router.include_router(reasoning.router, prefix="/reasoning", tags=["reasoning"])
