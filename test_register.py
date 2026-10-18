"""Manual local registration diagnostic.

The script performs no request when imported by pytest. Use an explicitly
provided disposable email when running it directly.
"""

from __future__ import annotations

import os


def main() -> int:
    email = os.environ.get("TEST_REGISTRATION_EMAIL")
    password = os.environ.get("TEST_REGISTRATION_PASSWORD")
    if not email or not password:
        print("Set TEST_REGISTRATION_EMAIL and TEST_REGISTRATION_PASSWORD to run this check.")
        return 2

    import requests

    base_url = os.environ.get("TEST_API_URL", "http://localhost:8000/api/v1").rstrip("/")
    try:
        response = requests.post(
            f"{base_url}/users/",
            json={"email": email, "password": password, "full_name": "Manual Test User"},
            timeout=10,
        )
    except requests.RequestException as exc:
        print(f"Request failed: {exc.__class__.__name__}")
        return 1

    print(f"Status code: {response.status_code}")
    return 0 if response.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
