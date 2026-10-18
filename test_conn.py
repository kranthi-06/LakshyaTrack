"""Manual database connectivity diagnostic.

This module is intentionally inert when imported by pytest. Configure
DATABASE_URL in the environment and run it directly if a manual check is
needed; credentials must never be embedded in source control.
"""

from __future__ import annotations

import os


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set; no connection attempted.")
        return 2

    import psycopg2

    try:
        with psycopg2.connect(database_url, connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
    except psycopg2.Error as exc:
        print(f"Connection failed: {exc.__class__.__name__}")
        return 1

    print("Connection succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
