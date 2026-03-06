"""
Opportunity Portal Service — aggregates courses, internships, jobs, and certifications
from trusted public sources including RSS feeds, public APIs, and AI curation.
NO scraping of protected platforms.
"""
import json
import logging
import hashlib
import asyncio
import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text
from app.services.ai_service import ai_hub
from app.models.career import Opportunity

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════
# TRUSTED SOURCES CONFIGURATION
# ════════════════════════════════════════════════════════════

RSS_FEEDS = {
    "courses": [
        {
            "url": "https://www.classcentral.com/report/feed/",
            "source": "Class Central",
            "category": "course",
        },
    ],
    "jobs": [
        {
            "url": "https://remoteok.com/remote-dev-jobs.rss",
            "source": "RemoteOK",
            "category": "job",
        },
        {
            "url": "https://weworkremotely.com/categories/remote-programming-jobs.rss",
            "source": "WeWorkRemotely",
            "category": "job",
        },
    ],
    "internships": [
        {
            "url": "https://www.indeed.com/rss?q=software+intern&l=remote",
            "source": "Indeed",
            "category": "internship",
        },
    ],
}

# Public API endpoints (no auth required)
PUBLIC_APIS = [
    {
        "name": "GitHub Jobs (proxy via dev.to)",
        "url": "https://dev.to/api/listings?category=jobs&per_page=10",
        "source": "dev.to",
        "category": "job",
    },
]

CATEGORY_MAP = {
    "course": "course",
    "courses": "course",
    "internship": "internship",
    "internships": "internship",
    "job": "job",
    "jobs": "job",
    "certification": "certification",
    "certifications": "certification",
}


# ════════════════════════════════════════════════════════════
# RSS FEED FETCHING
# ════════════════════════════════════════════════════════════

async def fetch_rss_opportunities(db: Session) -> int:
    """
    Fetch opportunities from RSS feeds and save to database.
    Returns count of new items saved.
    """
    saved_count = 0

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for category_key, feeds in RSS_FEEDS.items():
            for feed_config in feeds:
                try:
                    resp = await client.get(
                        feed_config["url"],
                        headers={"User-Agent": "VidyaMithra-OpportunityBot/1.0"}
                    )
                    if resp.status_code != 200:
                        logger.warning(f"RSS feed {feed_config['source']} returned {resp.status_code}")
                        continue

                    items = _parse_rss_xml(resp.text)
                    for item in items[:15]:  # Limit per feed
                        title = item.get("title", "").strip()
                        url = item.get("link", "").strip()
                        if not title or not url:
                            continue

                        # Dedup check
                        content_hash = hashlib.md5(f"{title}:{url}".encode()).hexdigest()
                        existing = db.query(Opportunity).filter(
                            Opportunity.title == title,
                            Opportunity.source == feed_config["source"]
                        ).first()
                        if existing:
                            continue

                        new_opp = Opportunity(
                            title=title,
                            company=feed_config["source"],
                            provider=feed_config["source"],
                            opportunity_type=feed_config["category"],
                            category=feed_config["category"],
                            description=item.get("description", "")[:500],
                            url=url,
                            source=feed_config["source"],
                            skill_tags=[],
                            location="Remote",
                        )
                        db.add(new_opp)
                        saved_count += 1

                    db.commit()
                except Exception as e:
                    logger.error(f"Error fetching RSS {feed_config['source']}: {e}")
                    db.rollback()

    return saved_count


def _parse_rss_xml(xml_text: str) -> List[dict]:
    """Simple XML parser for RSS feeds without external dependency."""
    import re
    items = []
    # Find all <item> blocks
    item_blocks = re.findall(r'<item>(.*?)</item>', xml_text, re.DOTALL)
    for block in item_blocks:
        title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', block)
        link_match = re.search(r'<link>(.*?)</link>', block)
        desc_match = re.search(
            r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>',
            block, re.DOTALL
        )

        title = ""
        if title_match:
            title = title_match.group(1) or title_match.group(2) or ""

        link = link_match.group(1).strip() if link_match else ""
        desc = ""
        if desc_match:
            desc = desc_match.group(1) or desc_match.group(2) or ""
            # Strip HTML tags from description
            desc = re.sub(r'<[^>]+>', '', desc).strip()

        if title:
            items.append({"title": title, "link": link, "description": desc})

    return items


# ════════════════════════════════════════════════════════════
# PUBLIC API FETCHING
# ════════════════════════════════════════════════════════════

async def fetch_public_api_opportunities(db: Session) -> int:
    """Fetch from public APIs and save to database."""
    saved_count = 0

    async with httpx.AsyncClient(timeout=15.0) as client:
        for api_config in PUBLIC_APIS:
            try:
                resp = await client.get(
                    api_config["url"],
                    headers={"User-Agent": "VidyaMithra-OpportunityBot/1.0"}
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                listings = data if isinstance(data, list) else data.get("listings", data.get("results", []))

                for item in listings[:10]:
                    title = item.get("title", "").strip()
                    url = item.get("url") or item.get("slug", "")
                    if url and not url.startswith("http"):
                        url = f"https://dev.to/listings/{url}"
                    if not title or not url:
                        continue

                    existing = db.query(Opportunity).filter(
                        Opportunity.title == title,
                        Opportunity.source == api_config["source"]
                    ).first()
                    if existing:
                        continue

                    tags = item.get("tag_list", item.get("tags", []))
                    if isinstance(tags, str):
                        tags = [t.strip() for t in tags.split(",")]

                    new_opp = Opportunity(
                        title=title,
                        company=item.get("organization", api_config["source"]),
                        provider=api_config["source"],
                        opportunity_type=api_config["category"],
                        category=api_config["category"],
                        description=(item.get("body_markdown") or item.get("description") or "")[:500],
                        url=url,
                        source=api_config["source"],
                        skill_tags=tags[:10] if tags else [],
                        location=item.get("location", "Remote"),
                    )
                    db.add(new_opp)
                    saved_count += 1

                db.commit()
            except Exception as e:
                logger.error(f"Error fetching API {api_config['name']}: {e}")
                db.rollback()

    return saved_count


# ════════════════════════════════════════════════════════════
# AI-POWERED OPPORTUNITY GENERATION
# ════════════════════════════════════════════════════════════

async def generate_opportunities(
    target_role: str,
    skills: List[str],
    level: str,
    db: Session,
    categories: List[str] = None
) -> List[dict]:
    """
    Use AI to generate/curate opportunity suggestions across all four categories.
    These are real platform links (not scraped content).
    """
    cats = categories or ["course", "internship", "certification", "job"]
    cats_str = ", ".join(cats)

    system_prompt = (
        "You are a career advisor who knows major online learning, certification, and job platforms. "
        "You suggest REAL opportunities from platforms like Coursera, edX, Udemy, Google, AWS, "
        "LinkedIn Learning, GitHub Jobs, AngelList, Internshala, HackerRank, and official company career pages. "
        "Do NOT invent fake companies or listings. "
        "Provide search/category links to real platforms where users can find relevant opportunities."
    )

    prompt = f"""
    Suggest 12 opportunities (mix of {cats_str}) for someone targeting \
the role "{target_role}" with skills: {json.dumps(skills)} at {level} level.

    For each opportunity, provide:
    - "title": opportunity title
    - "company": platform or company name (must be real)
    - "provider": the platform offering it (Coursera, Udemy, AWS, Google, etc.)
    - "opportunity_type": "{'" | "'.join(cats)}"
    - "category": same as opportunity_type
    - "description": one-sentence description
    - "url": direct link to the platform's search/category page (NOT a specific listing URL \
that may expire)
    - "source": platform name
    - "skill_tags": list of relevant skills (max 5)
    - "level": "Beginner" | "Intermediate" | "Advanced"
    - "location": "Remote" or specific city/country
    - "salary_range": estimated range or "Free" for courses, or "Varies" for certifications
    - "deadline": null or ISO date string if applicable

    Rules:
    - Use only legitimate, publicly accessible platforms
    - URLs should be search result pages or category pages, NOT specific listing URLs
    - Include a mix of: 3 courses, 3 internships, 3 certifications, 3 jobs
    - Match the skill level appropriately
    - For certifications, include real ones from AWS, Google, Microsoft, Oracle, etc.

    Return ONLY valid JSON array:
    [
        {{
            "title": "...",
            "company": "Google",
            "provider": "Google Cloud",
            "opportunity_type": "certification",
            "category": "certification",
            "description": "...",
            "url": "https://cloud.google.com/certification",
            "source": "google",
            "skill_tags": ["Cloud", "GCP"],
            "level": "Intermediate",
            "location": "Remote",
            "salary_range": "$200",
            "deadline": null
        }}
    ]

    IMPORTANT: Return ONLY valid JSON. No markdown.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            system_prompt
        )

        clean = response.strip()
        if "```json" in clean:
            clean = clean.split("```json")[1].split("```")[0].strip()
        elif "```" in clean:
            clean = clean.split("```")[1].split("```")[0].strip()

        opportunities = json.loads(clean)

        if not isinstance(opportunities, list):
            return []

        # Save to database (deduplicate by title + source)
        saved = []
        for opp in opportunities:
            if not all(k in opp for k in ["title", "url", "opportunity_type"]):
                continue

            cat = CATEGORY_MAP.get(opp.get("category", opp["opportunity_type"]), opp["opportunity_type"])

            # Check for duplicate
            existing = db.query(Opportunity).filter(
                Opportunity.title == opp["title"],
                Opportunity.source == opp.get("source", "")
            ).first()

            if existing:
                saved.append(_opp_to_dict(existing))
                continue

            deadline = None
            if opp.get("deadline"):
                try:
                    deadline = datetime.fromisoformat(opp["deadline"].replace("Z", "+00:00"))
                except:
                    pass

            new_opp = Opportunity(
                title=opp["title"],
                company=opp.get("company"),
                provider=opp.get("provider", opp.get("company")),
                opportunity_type=opp["opportunity_type"],
                category=cat,
                description=opp.get("description"),
                url=opp["url"],
                source=opp.get("source"),
                skill_tags=opp.get("skill_tags", []),
                level=opp.get("level"),
                location=opp.get("location"),
                salary_range=opp.get("salary_range"),
                deadline=deadline,
            )
            db.add(new_opp)
            try:
                db.commit()
                db.refresh(new_opp)
                saved.append(_opp_to_dict(new_opp))
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to save opportunity: {e}")

        return saved

    except json.JSONDecodeError:
        logger.error("Failed to parse opportunities JSON")
        return []
    except Exception as e:
        logger.error(f"Opportunity generation error: {e}")
        return []


# ════════════════════════════════════════════════════════════
# BROWSE / SEARCH / FILTER
# ════════════════════════════════════════════════════════════

def browse_opportunities(
    db: Session,
    category: Optional[str] = None,
    skill: Optional[str] = None,
    location: Optional[str] = None,
    search_query: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Browse opportunities with filters and pagination."""
    query = db.query(Opportunity).filter(Opportunity.is_expired == False)

    # Category filter
    if category and category != "all":
        cat = CATEGORY_MAP.get(category.lower(), category.lower())
        query = query.filter(
            or_(Opportunity.category == cat, Opportunity.opportunity_type == cat)
        )

    # Location filter
    if location and location.lower() not in ("all", "nationwide"):
        query = query.filter(
            Opportunity.location.ilike(f"%{location}%")
        )

    # Skill tag filter
    if skill:
        # JSONB contains check
        query = query.filter(
            Opportunity.skill_tags.cast(text("TEXT")).ilike(f"%{skill}%")
        )

    # Text search across title, description, company
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

    total = query.count()
    opportunities = (
        query
        .order_by(Opportunity.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "opportunities": [_opp_to_dict(o) for o in opportunities],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


def get_matched_opportunities(
    user_skills: List[str],
    level: Optional[str],
    opportunity_type: Optional[str],
    db: Session,
    limit: int = 20
) -> List[dict]:
    """
    Get opportunities matched to user skills from the database.
    Filters out expired ones.
    """
    query = db.query(Opportunity).filter(Opportunity.is_expired == False)

    if opportunity_type:
        cat = CATEGORY_MAP.get(opportunity_type.lower(), opportunity_type.lower())
        query = query.filter(
            or_(Opportunity.opportunity_type == cat, Opportunity.category == cat)
        )
    if level:
        query = query.filter(Opportunity.level == level)

    all_opps = query.order_by(Opportunity.created_at.desc()).limit(limit * 3).all()

    # Score by skill match
    scored = []
    user_skills_lower = {s.lower() for s in user_skills}
    for opp in all_opps:
        tags = [t.lower() for t in (opp.skill_tags or [])]
        match_count = len(user_skills_lower.intersection(tags))
        scored.append((match_count, opp))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {**_opp_to_dict(opp), "match_score": score}
        for score, opp in scored[:limit]
    ]


# ════════════════════════════════════════════════════════════
# AI RECOMMENDATIONS BASED ON USER PROFILE
# ════════════════════════════════════════════════════════════

async def get_ai_recommendations(
    user_skills: List[str],
    user_role: str,
    db: Session,
    limit: int = 12
) -> List[dict]:
    """
    Get AI-powered recommendations by matching user's resume skills
    against DB opportunities, then enhancing with AI-generated ones.
    """
    # First: match from existing DB
    matched = get_matched_opportunities(
        user_skills=user_skills,
        level=None,
        opportunity_type=None,
        db=db,
        limit=limit
    )

    # If we have enough, return them
    if len(matched) >= limit:
        return matched[:limit]

    # Otherwise: generate new AI opportunities tailored to user
    needed = limit - len(matched)
    try:
        generated = await generate_opportunities(
            target_role=user_role or "Software Engineer",
            skills=user_skills,
            level="Intermediate",
            db=db,
        )
        # Combine and deduplicate
        seen_titles = {m["title"].lower() for m in matched}
        for g in generated:
            if g["title"].lower() not in seen_titles:
                matched.append(g)
                seen_titles.add(g["title"].lower())
                if len(matched) >= limit:
                    break
    except Exception as e:
        logger.error(f"AI recommendation generation error: {e}")

    return matched[:limit]


# ════════════════════════════════════════════════════════════
# AI SKILL EXTRACTION & CATEGORIZATION
# ════════════════════════════════════════════════════════════

async def enrich_opportunities_with_ai(db: Session, batch_size: int = 20) -> int:
    """
    Run AI on opportunities that have empty skill_tags to extract skills
    and properly categorize them.
    """
    # Find opps with empty skill tags
    opps = (
        db.query(Opportunity)
        .filter(
            Opportunity.is_expired == False,
            or_(
                Opportunity.skill_tags == None,
                Opportunity.skill_tags == [],
            )
        )
        .limit(batch_size)
        .all()
    )

    if not opps:
        return 0

    # Build batch prompt
    items = []
    for opp in opps:
        items.append({
            "id": str(opp.id),
            "title": opp.title,
            "description": (opp.description or "")[:200],
            "type": opp.opportunity_type,
        })

    prompt = f"""
    For each opportunity below, extract relevant technical skills and assign the correct category.
    Categories: course, internship, certification, job

    Opportunities:
    {json.dumps(items)}

    Return JSON array with:
    [
        {{
            "id": "uuid",
            "skill_tags": ["Python", "React", ...],
            "category": "job"
        }}
    ]

    IMPORTANT: Return ONLY valid JSON. No markdown.
    """

    try:
        response = await ai_hub.chat_completion(
            [{"role": "user", "content": prompt}],
            "You are a technical skill extractor. Extract programming languages, frameworks, and tools from opportunity descriptions."
        )

        clean = response.strip()
        if "```json" in clean:
            clean = clean.split("```json")[1].split("```")[0].strip()
        elif "```" in clean:
            clean = clean.split("```")[1].split("```")[0].strip()

        enrichments = json.loads(clean)
        count = 0

        for enrichment in enrichments:
            opp_id = enrichment.get("id")
            if not opp_id:
                continue
            opp = db.query(Opportunity).filter(Opportunity.id == opp_id).first()
            if opp:
                opp.skill_tags = enrichment.get("skill_tags", [])
                if enrichment.get("category"):
                    opp.category = enrichment["category"]
                count += 1

        db.commit()
        return count
    except Exception as e:
        logger.error(f"AI enrichment error: {e}")
        db.rollback()
        return 0


# ════════════════════════════════════════════════════════════
# CLEANUP & MAINTENANCE
# ════════════════════════════════════════════════════════════

def cleanup_expired_opportunities(db: Session) -> int:
    """Mark opportunities with past deadlines as expired."""
    now = datetime.now(timezone.utc)
    count = db.query(Opportunity).filter(
        Opportunity.deadline != None,
        Opportunity.deadline < now,
        Opportunity.is_expired == False
    ).update({"is_expired": True})
    db.commit()
    return count


def remove_duplicates(db: Session) -> int:
    """Remove duplicate opportunities based on title + source."""
    # Find duplicates
    from sqlalchemy import func as sqlfunc
    dupes = (
        db.query(Opportunity.title, Opportunity.source, sqlfunc.count(Opportunity.id).label("cnt"))
        .group_by(Opportunity.title, Opportunity.source)
        .having(sqlfunc.count(Opportunity.id) > 1)
        .all()
    )

    removed = 0
    for title, source, cnt in dupes:
        # Keep the newest, delete the rest
        all_matches = (
            db.query(Opportunity)
            .filter(Opportunity.title == title, Opportunity.source == source)
            .order_by(Opportunity.created_at.desc())
            .all()
        )
        for opp in all_matches[1:]:  # Skip the first (newest)
            db.delete(opp)
            removed += 1

    db.commit()
    return removed


def get_filter_options(db: Session) -> dict:
    """Get available filter options from current data."""
    # Get unique locations
    locations = (
        db.query(Opportunity.location)
        .filter(Opportunity.is_expired == False, Opportunity.location != None)
        .distinct()
        .all()
    )

    # Get category counts
    category_counts = (
        db.query(
            Opportunity.category,
            func.count(Opportunity.id)
        )
        .filter(Opportunity.is_expired == False)
        .group_by(Opportunity.category)
        .all()
    )

    # Get top skills
    all_opps = (
        db.query(Opportunity.skill_tags)
        .filter(Opportunity.is_expired == False, Opportunity.skill_tags != None)
        .limit(200)
        .all()
    )
    skill_freq: Dict[str, int] = {}
    for (tags,) in all_opps:
        if tags:
            for tag in tags:
                skill_freq[tag] = skill_freq.get(tag, 0) + 1

    top_skills = sorted(skill_freq.items(), key=lambda x: x[1], reverse=True)[:30]

    return {
        "locations": sorted(set(loc[0] for loc in locations if loc[0])),
        "categories": {cat: cnt for cat, cnt in category_counts if cat},
        "top_skills": [s[0] for s in top_skills],
    }


# ════════════════════════════════════════════════════════════
# HELPER
# ════════════════════════════════════════════════════════════

def _opp_to_dict(opp: Opportunity) -> dict:
    """Convert an Opportunity ORM object to a dict."""
    return {
        "id": str(opp.id),
        "title": opp.title,
        "company": opp.company,
        "provider": opp.provider or opp.company,
        "opportunity_type": opp.opportunity_type,
        "category": opp.category or opp.opportunity_type,
        "description": opp.description,
        "url": opp.url,
        "source": opp.source,
        "skill_tags": opp.skill_tags or [],
        "level": opp.level,
        "location": opp.location,
        "salary_range": opp.salary_range,
        "deadline": opp.deadline.isoformat() if opp.deadline else None,
        "created_at": opp.created_at.isoformat() if opp.created_at else None,
    }
