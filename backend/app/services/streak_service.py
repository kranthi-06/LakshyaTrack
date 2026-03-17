from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from typing import Any, Dict, Optional

from app.db.mongodb import get_collection


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _as_utc_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).date()
    if isinstance(value, str):
        try:
            if "T" in value:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).date()
            return date.fromisoformat(value)
        except Exception:
            return None
    return None


def get_streak(user_id: str) -> Dict[str, Any]:
    """
    Return streak stats for the current user.
    Safe fallback if MongoDB isn't configured.
    """
    col = get_collection("user_streaks")
    if col is None:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "last_active_date": None,
            "updated_at": None,
        }

    doc = col.find_one({"user_id": user_id})
    if not doc:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "last_active_date": None,
            "updated_at": None,
        }

    last_active = _as_utc_date(doc.get("last_active_date"))
    updated_at = doc.get("updated_at")
    return {
        "current_streak": int(doc.get("current_streak") or 0),
        "longest_streak": int(doc.get("longest_streak") or 0),
        "last_active_date": last_active.isoformat() if last_active else None,
        "updated_at": (updated_at.astimezone(timezone.utc).isoformat() if isinstance(updated_at, datetime) else None),
    }


def touch_streak(user_id: str) -> Dict[str, Any]:
    """
    Increment streak once per UTC day.
    Should be called on daily login or first app load each day.
    """
    col = get_collection("user_streaks")
    if col is None:
        return get_streak(user_id)

    today = _utc_today()
    now = datetime.now(timezone.utc)

    doc = col.find_one({"user_id": user_id}) or {}
    last_active = _as_utc_date(doc.get("last_active_date"))

    current = int(doc.get("current_streak") or 0)
    longest = int(doc.get("longest_streak") or 0)

    if last_active == today:
        pass
    elif last_active == (today - timedelta(days=1)):
        current += 1
    else:
        current = 1

    longest = max(longest, current)

    col.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "current_streak": current,
            "longest_streak": longest,
            "last_active_date": datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc),
            "updated_at": now,
        }},
        upsert=True,
    )

    return {
        "current_streak": current,
        "longest_streak": longest,
        "last_active_date": today.isoformat(),
        "updated_at": now.isoformat(),
    }

