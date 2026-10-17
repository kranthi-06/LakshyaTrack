from app.services.learning_content_service import fetch_youtube_videos


async def search_youtube_videos(query: str, max_results: int = 6):
    """Return real YouTube results only.

    When the YouTube API key is missing or the upstream call fails, an empty
    list is returned so the frontend can render an explicit empty state.
    """
    normalized_query = (query or "").strip()
    if not normalized_query:
        return []

    videos = await fetch_youtube_videos(normalized_query, max_results=max_results)
    return [
        {**video, "id": video.get("videoId", "")}
        for video in videos
    ]
