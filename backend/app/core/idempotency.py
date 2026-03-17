import base64
import hashlib
from typing import Optional, Tuple


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_idempotency_storage_key(
    *,
    method: str,
    path: str,
    idempotency_key: str,
    authorization_header: Optional[str],
    body_bytes: bytes,
) -> Tuple[str, str]:
    """
    Returns:
      - idem_key: stable key used for storage lookup
      - request_hash: fingerprint to prevent replaying mismatched requests
    """
    auth_part = ""
    if authorization_header:
        auth_part = _sha256_hex(authorization_header.encode("utf-8"))

    body_hash = _sha256_hex(body_bytes or b"")
    request_hash = _sha256_hex(
        f"{method}|{path}|{auth_part}|{body_hash}".encode("utf-8")
    )

    idem_key = _sha256_hex(
        f"{method}|{path}|{idempotency_key}|{auth_part}|{body_hash}".encode("utf-8")
    )
    return idem_key, request_hash

