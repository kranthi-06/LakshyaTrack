"""Manual, opt-in infrastructure connectivity checks.

This script reads credentials only from the process environment or backend/.env.
It intentionally contains no fallback credentials and redacts failure details.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv("backend/.env")


def check_postgres() -> bool:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("PostgreSQL: DATABASE_URL is not configured")
        return False
    import psycopg2

    try:
        with psycopg2.connect(database_url, connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
    except psycopg2.Error as exc:
        print(f"PostgreSQL: failed ({exc.__class__.__name__})")
        return False
    print("PostgreSQL: connected")
    return True


def check_mongodb() -> bool:
    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("MongoDB: MONGODB_URI is not configured")
        return False
    from pymongo import MongoClient

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5_000)
        client.admin.command("ping")
        client.close()
    except Exception as exc:
        print(f"MongoDB: failed ({exc.__class__.__name__})")
        return False
    print("MongoDB: connected")
    return True


def check_supabase_auth() -> bool:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("Supabase Auth: SUPABASE_URL or SUPABASE_KEY is not configured")
        return False
    import requests

    try:
        response = requests.get(
            f"{url.rstrip('/')}/auth/v1/health",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        print(f"Supabase Auth: failed ({exc.__class__.__name__})")
        return False
    ok = response.status_code == 200
    print(f"Supabase Auth: {'connected' if ok else f'failed (HTTP {response.status_code})'}")
    return ok


if __name__ == "__main__":
    results = [check_postgres(), check_mongodb(), check_supabase_auth()]
    raise SystemExit(0 if all(results) else 1)
