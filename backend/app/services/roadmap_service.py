"""
AI Roadmap Engine — generates personalized skill roadmaps.
Uses existing AIService (ai_hub) for LLM calls.
Supports multiple roadmaps per user with active-roadmap switching.
"""
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.services.ai_service import ai_hub
from app.models.career import Roadmap
from app.core.resilience import safe_json_parse, sanitize_for_logging

logger = logging.getLogger(__name__)

# ─── Pass thresholds per level ────────────────────────────
PASS_THRESHOLDS = {
    "Beginner": 70,
    "Intermediate": 80,
    "Advanced": 85
}


async def generate_roadmap(
    user_id: str,
    target_role: str,
    current_skills: List[str],
    skill_gaps: List[str],
    db: Session,
    topic_name: Optional[str] = None,
    difficulty: Optional[str] = None,
    commit: bool = True,
) -> dict:
    """
    Generate a personalized skill roadmap using AI.
    Persists the result in the database.
    If topic_name is provided, it's used as the learning topic (custom roadmap).
    Difficulty can be 'Beginner', 'Intermediate', or 'Advanced' to bias the content.
    """
    try:
        roadmap_data = {
            "levels": [
                {
                    "name": "Beginner",
                    "pass_threshold": 70,
                    "skills": []
                },
                {
                    "name": "Intermediate",
                    "pass_threshold": 80,
                    "skills": []
                },
                {
                    "name": "Advanced",
                    "pass_threshold": 85,
                    "skills": []
                }
            ]
        }

        # Deactivate ALL existing roadmaps for this user so only the new one is active
        db.query(Roadmap).filter(
            Roadmap.user_id == user_id,
            Roadmap.is_active == True
        ).update({"is_active": False})

        # Persist to database as pending
        roadmap = Roadmap(
            user_id=user_id,
            target_role=target_role,
            topic_name=topic_name or target_role,
            current_skills=current_skills,
            skill_gaps=skill_gaps,
            roadmap_data=roadmap_data, # skeleton
            is_active=True,
            generation_status="pending",
            last_opened=datetime.now(timezone.utc),
        )
        db.add(roadmap)
        db.flush()
        db.refresh(roadmap)
        
        roadmap_id = str(roadmap.id)
        if commit:
            db.commit()

        return {
            "id": roadmap_id,
            "target_role": target_role,
            "topic_name": roadmap.topic_name,
            "roadmap_data": roadmap_data,
            "generation_status": "pending",
            "created_at": str(roadmap.created_at)
        }
    except Exception as e:
        logger.error("Roadmap initial creation error: %s", sanitize_for_logging(str(e)))
        if commit:
            db.rollback()
        raise


async def generate_roadmap_background(
    roadmap_id: str,
    target_role: str,
    current_skills: List[str],
    skill_gaps: List[str],
    topic_name: Optional[str],
    difficulty: Optional[str],
) -> None:
    """Background task to generate the roadmap data and update the database."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    
    system_prompt = (
        "You are an expert career coach and curriculum designer. "
        "You build structured learning roadmaps for tech professionals. "
        "You must NEVER invent fake skills or experience. "
        "All suggestions must be real, verifiable, and role-specific."
    )

    difficulty_hint = ""
    if difficulty:
        difficulty_hint = f"\nNote: The user has indicated they are at {difficulty} level, so adjust the difficulty of each level accordingly."

    prompt = f"""
    Create a detailed skill learning roadmap for someone targeting the role of "{target_role}".

    Their current skills are: {json.dumps(current_skills)}
    Their identified skill gaps are: {json.dumps(skill_gaps)}
    {difficulty_hint}

    Generate a roadmap with exactly 3 levels: Beginner, Intermediate, Advanced.

    For each level, list 3-5 skills that should be learned IN ORDER.
    Each skill must have:
    - "id": a unique identifier (use format "skill-<short-slug>")
    - "name": human-readable skill name
    - "description": one-sentence description of what to learn
    - "prerequisites": list of skill IDs that must be completed first (empty for first skills)
    - "estimated_hours": estimated learning hours (integer)
    - "order": integer ordering within the level (1-based)

    Rules:
    - Beginner skills should have NO prerequisites from higher levels
    - Intermediate skills can depend on Beginner skills
    - Advanced skills can depend on Intermediate skills
    - Keep it practical and industry-relevant for {target_role}

    Return ONLY valid JSON in this exact format:
    {{
        "levels": [
            {{
                "name": "Beginner",
                "pass_threshold": 70,
                "skills": [
                    {{
                        "id": "skill-html-css",
                        "name": "HTML & CSS Fundamentals",
                        "description": "...",
                        "prerequisites": [],
                        "estimated_hours": 20,
                        "order": 1
                    }}
                ]
            }},
            {{
                "name": "Intermediate",
                "pass_threshold": 80,
                "skills": [...]
            }},
            {{
                "name": "Advanced",
                "pass_threshold": 85,
                "skills": [...]
            }}
        ]
    }}

    IMPORTANT: Return ONLY valid JSON. No markdown, no conversational text.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )

        roadmap_data = safe_json_parse(response)
        if roadmap_data is None:
            raise ValueError("AI returned invalid JSON for roadmap")

        # Add status to each skill: first skill of Beginner is "unlocked", rest are "locked"
        for level_idx, level in enumerate(roadmap_data.get("levels", [])):
            for skill_idx, skill in enumerate(level.get("skills", [])):
                if level_idx == 0 and skill_idx == 0:
                    skill["status"] = "unlocked"
                elif level_idx == 0 and not skill.get("prerequisites"):
                    skill["status"] = "unlocked"
                else:
                    skill["status"] = "locked"

        from sqlalchemy.orm.attributes import flag_modified
        roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).with_for_update().first()
        if roadmap:
            roadmap.roadmap_data = roadmap_data
            roadmap.generation_status = "completed"
            flag_modified(roadmap, "roadmap_data")
            db.commit()

    except Exception as e:
        logger.error("Background roadmap generation failed: %s", sanitize_for_logging(str(e)))
        roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).with_for_update().first()
        if roadmap:
            roadmap.generation_status = "failed"
            roadmap.generation_error = str(e)
            db.commit()
    finally:
        db.close()
def get_user_roadmap(user_id: str, db: Session) -> Optional[dict]:
    """Get the active roadmap for a user."""
    roadmap = db.query(Roadmap).filter(
        Roadmap.user_id == user_id,
        Roadmap.is_active == True
    ).order_by(Roadmap.created_at.desc()).first()

    if not roadmap:
        # Self-heal older/inconsistent records where a roadmap exists but none is marked active.
        roadmap = db.query(Roadmap).filter(
            Roadmap.user_id == user_id,
        ).order_by(Roadmap.last_opened.desc().nullslast(), Roadmap.created_at.desc()).first()

        if not roadmap:
            return None

        roadmap.is_active = True
        roadmap.last_opened = datetime.now(timezone.utc)
        db.commit()
        db.refresh(roadmap)

    return {
        "id": str(roadmap.id),
        "target_role": roadmap.target_role,
        "topic_name": roadmap.topic_name or roadmap.target_role,
        "current_skills": roadmap.current_skills,
        "skill_gaps": roadmap.skill_gaps,
        "roadmap_data": roadmap.roadmap_data,
        "generation_status": roadmap.generation_status,
        "created_at": str(roadmap.created_at),
        "updated_at": str(roadmap.updated_at)
    }


def get_all_user_roadmaps(user_id: str, db: Session) -> list:
    """Get all roadmaps for a user (for the switcher UI)."""
    roadmaps = db.query(Roadmap).filter(
        Roadmap.user_id == user_id,
    ).order_by(Roadmap.last_opened.desc().nullslast(), Roadmap.created_at.desc()).all()

    return [
        {
            "id": str(r.id),
            "target_role": r.target_role,
            "topic_name": r.topic_name or r.target_role,
            "is_active": r.is_active,
            "generation_status": r.generation_status,
            "created_at": str(r.created_at),
            "last_opened": str(r.last_opened) if r.last_opened else str(r.created_at),
        }
        for r in roadmaps
    ]


def set_active_roadmap(user_id: str, roadmap_id: str, db: Session) -> dict:
    """Switch the active roadmap for a user. Deactivates all others."""
    # Deactivate all
    db.query(Roadmap).filter(
        Roadmap.user_id == user_id,
        Roadmap.is_active == True
    ).update({"is_active": False})

    # Activate the selected one
    roadmap = db.query(Roadmap).filter(
        Roadmap.id == roadmap_id,
        Roadmap.user_id == user_id
    ).first()

    if not roadmap:
        raise ValueError("Roadmap not found")

    roadmap.is_active = True
    roadmap.last_opened = datetime.now(timezone.utc)
    db.commit()
    db.refresh(roadmap)

    return {
        "id": str(roadmap.id),
        "target_role": roadmap.target_role,
        "topic_name": roadmap.topic_name or roadmap.target_role,
        "roadmap_data": roadmap.roadmap_data,
        "generation_status": roadmap.generation_status,
        "created_at": str(roadmap.created_at),
        "updated_at": str(roadmap.updated_at)
    }


def delete_roadmap(user_id: str, roadmap_id: str, db: Session, commit: bool = True) -> dict:
    """Delete a specific roadmap for a user."""
    roadmap = db.query(Roadmap).filter(
        Roadmap.id == roadmap_id,
        Roadmap.user_id == user_id
    ).first()

    if not roadmap:
        raise ValueError("Roadmap not found")

    was_active = roadmap.is_active
    db.delete(roadmap)
    db.flush()

    # If the deleted roadmap was active, activate the most recent remaining one
    if was_active:
        next_roadmap = db.query(Roadmap).filter(
            Roadmap.user_id == user_id
        ).order_by(Roadmap.last_opened.desc().nullslast(), Roadmap.created_at.desc()).first()
        if next_roadmap:
            next_roadmap.is_active = True
    if commit:
        db.commit()

    return {"deleted": True}


def update_skill_status(
    user_id: str,
    roadmap_id: str,
    skill_id: str,
    new_status: str,
    db: Session
) -> dict:
    """
    Update a skill's status in the roadmap.
    When a skill is completed, unlock dependent skills.
    """
    roadmap = db.query(Roadmap).filter(
        Roadmap.id == roadmap_id,
        Roadmap.user_id == user_id
    ).first()

    if not roadmap:
        raise ValueError("Roadmap not found")

    data = roadmap.roadmap_data
    skill_found = False

    for level in data.get("levels", []):
        for skill in level.get("skills", []):
            if skill["id"] == skill_id:
                skill["status"] = new_status
                skill_found = True
                break

    if not skill_found:
        raise ValueError(f"Skill {skill_id} not found in roadmap")

    # If skill was completed, unlock dependent skills
    if new_status == "completed":
        for level in data.get("levels", []):
            for skill in level.get("skills", []):
                if skill["status"] == "locked":
                    prereqs = skill.get("prerequisites", [])
                    if skill_id in prereqs:
                        # Check if ALL prerequisites are completed
                        all_met = True
                        for prereq_id in prereqs:
                            prereq_completed = False
                            for l in data.get("levels", []):
                                for s in l.get("skills", []):
                                    if s["id"] == prereq_id and s["status"] == "completed":
                                        prereq_completed = True
                            if not prereq_completed:
                                all_met = False
                                break
                        if all_met:
                            skill["status"] = "unlocked"

    # Update in DB (force JSONB update)
    from sqlalchemy.orm.attributes import flag_modified
    roadmap.roadmap_data = data
    flag_modified(roadmap, "roadmap_data")
    db.commit()
    db.refresh(roadmap)

    return {
        "id": str(roadmap.id),
        "roadmap_data": roadmap.roadmap_data
    }


def check_level_completion(roadmap_data: dict, level_name: str) -> bool:
    """Check if all skills in a given level are completed."""
    for level in roadmap_data.get("levels", []):
        if level["name"] == level_name:
            for skill in level.get("skills", []):
                if skill["status"] != "completed":
                    return False
            return True
    return False
