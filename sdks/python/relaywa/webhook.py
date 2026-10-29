"""Verify RelayWA worker signatures against the original raw HTTP body."""
import hashlib
import hmac
import re
import time


def verify_webhook_signature(secret: str, timestamp: str, signature: str, raw_body: bytes | str, *, now_seconds: int | None = None, tolerance_seconds: int = 300) -> bool:
    if not isinstance(secret, str) or not secret or not isinstance(timestamp, str) or not re.fullmatch(r"[0-9]{10,15}", timestamp):
        return False
    if not isinstance(signature, str) or not re.fullmatch(r"sha256=[0-9a-f]{64}", signature):
        return False
    if type(tolerance_seconds) is not int or tolerance_seconds < 0:
        return False
    now = int(time.time()) if now_seconds is None else now_seconds
    if type(now) is not int or abs(now - int(timestamp)) > tolerance_seconds:
        return False
    if isinstance(raw_body, str):
        raw_body = raw_body.encode("utf-8")
    if not isinstance(raw_body, bytes):
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), timestamp.encode("ascii") + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
