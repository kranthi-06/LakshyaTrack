from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from app.api import deps
from app.services import resume_builder_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class PersonalInfoRequest(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    professional_summary: str = ""
    target_role: str = ""


class EducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    duration: str = ""
    description: str = ""


class EducationRequest(BaseModel):
    items: List[EducationItem]
    target_role: str = ""


class ExperienceItem(BaseModel):
    title: str = ""
    organization: str = ""
    duration: str = ""
    description: str = ""


class ExperienceRequest(BaseModel):
    items: List[ExperienceItem]
    target_role: str = ""


class ProjectItem(BaseModel):
    name: str = ""
    technologies: str = ""
    description: str = ""


class ProjectRequest(BaseModel):
    items: List[ProjectItem]
    target_role: str = ""


class SkillsRequest(BaseModel):
    raw_skills: str = ""
    target_role: str = ""


class ATSCheckRequest(BaseModel):
    resume_data: Dict[str, Any]
    target_role: str = ""


class RegenerateRequest(BaseModel):
    section_data: Dict[str, Any]
    mode: str = "stronger"
    target_role: str = ""


@router.post("/enhance/personal-info")
async def enhance_personal_info(
    request: PersonalInfoRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.enhance_personal_info(
            request.dict(), request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder personal info enhancement failed: %s", str(e))
        raise HTTPException(status_code=500, detail="AI enhancement failed")


@router.post("/enhance/education")
async def enhance_education(
    request: EducationRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.enhance_education(
            {"items": [item.dict() for item in request.items]}, request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder education enhancement failed: %s", str(e))
        raise HTTPException(status_code=500, detail="AI enhancement failed")


@router.post("/enhance/experience")
async def enhance_experience(
    request: ExperienceRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.enhance_experience(
            {"items": [item.dict() for item in request.items]}, request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder experience enhancement failed: %s", str(e))
        raise HTTPException(status_code=500, detail="AI enhancement failed")


@router.post("/enhance/projects")
async def enhance_projects(
    request: ProjectRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.enhance_projects(
            {"items": [item.dict() for item in request.items]}, request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder projects enhancement failed: %s", str(e))
        raise HTTPException(status_code=500, detail="AI enhancement failed")


@router.post("/enhance/skills")
async def enhance_skills(
    request: SkillsRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.enhance_skills(
            request.dict(), request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder skills enhancement failed: %s", str(e))
        raise HTTPException(status_code=500, detail="AI enhancement failed")


@router.post("/ats-check")
async def ats_check(
    request: ATSCheckRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.run_ats_check(
            request.resume_data, request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder ATS check failed: %s", str(e))
        raise HTTPException(status_code=500, detail="ATS check failed")


@router.post("/regenerate")
async def regenerate_section(
    request: RegenerateRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.regenerate_section(
            request.section_data, request.mode, request.target_role
        )
        return result
    except Exception as e:
        logger.exception("Resume builder regenerate failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Section regeneration failed")


class OptimizeRequest(BaseModel):
    resume_data: Dict[str, Any]
    target_role: str = ""
    template_style: str = "modern"


@router.post("/optimize")
async def optimize_resume(
    request: OptimizeRequest,
    current_user=Depends(deps.get_current_user_optional),
) -> Any:
    try:
        result = await resume_builder_service.optimize_full_resume(
            request.resume_data, request.target_role, request.template_style
        )
        return result
    except Exception as e:
        logger.exception("Resume builder optimize failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Resume optimization failed")

