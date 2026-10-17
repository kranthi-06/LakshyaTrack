"""
Learning Content Service — fetches REAL YouTube videos via YouTube Data API v3.
NO AI-generated fake videos. Only real data from the YouTube API.

Process:
1. Generate an optimized YouTube search query for the skill/topic.
2. Fetch up to 5 real videos using YouTube Data API v3 (search.list).
3. Store videoId, title, channelTitle, thumbnail.
4. Cache results in DB for reuse.
5. Frontend displays thumbnail cards → click opens real YouTube URL.
"""
import logging
import httpx
from typing import List
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.career import LearningCache

logger = logging.getLogger(__name__)

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def _build_search_query(skill_name: str, level: str) -> str:
    """Build an optimized YouTube search query for the skill and level."""
    level_keywords = {
        "Beginner": "tutorial for beginners",
        "Intermediate": "intermediate tutorial",
        "Advanced": "advanced deep dive"
    }
    level_suffix = level_keywords.get(level, "tutorial")
    return f"{skill_name} {level_suffix}"


async def fetch_youtube_videos(query: str, max_results: int = 5) -> List[dict]:
    """
    Call YouTube Data API v3 search.list to fetch real videos.
    Returns a list of video objects with real data only.
    """
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        logger.error("YOUTUBE_API_KEY is not configured.")
        return []

    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max_results,
        "order": "relevance",
        "key": api_key
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(YOUTUBE_SEARCH_URL, params=params)
            response.raise_for_status()
            data = response.json()

        videos = []
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            video_id = item.get("id", {}).get("videoId")
            if not video_id:
                continue

            videos.append({
                "videoId": video_id,
                "title": snippet.get("title", ""),
                "channel": snippet.get("channelTitle", ""),
                "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url")
                             or snippet.get("thumbnails", {}).get("medium", {}).get("url")
                             or snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "publishedAt": snippet.get("publishedAt", ""),
                "description": (snippet.get("description", "") or "")[:150]
            })

        logger.info(f"YouTube API returned {len(videos)} videos for query: {query}")
        return videos

    except httpx.HTTPStatusError as e:
        logger.error(f"YouTube API HTTP error: {e.response.status_code} - {e.response.text}")
        return []
    except Exception as e:
        logger.error(f"YouTube API request failed: {e}")
        return []


async def get_learning_resources(
    skill_name: str,
    level: str,
    db: Session
) -> List[dict]:
    """
    Get real YouTube videos for a skill. Checks cache first,
    fetches from YouTube Data API v3 if not cached.
    """
    # 1. Check cache
    cached = db.query(LearningCache).filter(
        LearningCache.skill_name == skill_name,
        LearningCache.level == level
    ).first()

    if cached and cached.resources:
        logger.info(f"Cache hit for {skill_name}/{level}")
        return cached.resources

    # 2. Build search query and fetch from YouTube API
    logger.info(f"Cache miss for {skill_name}/{level}, fetching from YouTube API...")
    query = _build_search_query(skill_name, level)
    videos = await fetch_youtube_videos(query, max_results=5)

    # 3. Cache the result (only if we got real data)
    if videos:
        try:
            cache_entry = LearningCache(
                skill_name=skill_name,
                level=level,
                resources=videos
            )
            db.merge(cache_entry)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to cache resources: {e}")
            db.rollback()

    return videos


def clear_skill_cache(skill_name: str, db: Session):
    """Clear cached resources for a skill (for manual refresh)."""
    db.query(LearningCache).filter(
        LearningCache.skill_name == skill_name
    ).delete()
    db.commit()
