from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Query, Session

from app.models.career import Opportunity


def get_existing_titles_by_source(db: Session, source: str, titles: list[str]) -> set[str]:
    if not titles:
        return set()
    rows = (
        db.query(Opportunity.title)
        .filter(
            Opportunity.source == source,
            Opportunity.title.in_(titles),
        )
        .all()
    )
    return {r[0] for r in rows if r and r[0]}


def build_browse_query(
    db: Session,
    category: Optional[str],
    skill: Optional[str],
    location: Optional[str],
    search_query: Optional[str],
    category_map: dict[str, str],
) -> Query:
    query = db.query(Opportunity).filter(Opportunity.is_expired == False)

    if category and category != "all":
        cat = category_map.get(category.lower(), category.lower())
        query = query.filter(or_(Opportunity.category == cat, Opportunity.opportunity_type == cat))

    if location and location.lower() not in ("all", "nationwide"):
        query = query.filter(Opportunity.location.ilike(f"%{location}%"))

    if skill:
        query = query.filter(Opportunity.skill_tags.cast(text("TEXT")).ilike(f"%{skill}%"))

    if search_query:
        search = f"%{search_query}%"
        query = query.filter(
            or_(
                Opportunity.title.ilike(search),
                Opportunity.description.ilike(search),
                Opportunity.company.ilike(search),
                Opportunity.provider.ilike(search),
                Opportunity.skill_tags.cast(text("TEXT")).ilike(search),
            )
        )
    return query


def apply_cursor_filter(
    query: Query,
    cursor_created_at: Optional[datetime],
    cursor_id: Optional[str],
) -> Query:
    if not (cursor_created_at and cursor_id):
        return query
    try:
        cursor_uuid = UUID(cursor_id)
        return query.filter(
            or_(
                Opportunity.created_at < cursor_created_at,
                and_(
                    Opportunity.created_at == cursor_created_at,
                    Opportunity.id < cursor_uuid,
                ),
            )
        )
    except Exception:
        return query
