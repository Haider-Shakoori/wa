"""RelayWA QR-linked-session API: Python 3.11+ send and signed webhook example.

No third-party packages. Not the official Meta WhatsApp Cloud API.
Run: python -m unittest discover -s examples/relaywa-python-webhooks -p "test_*.py"
Serve (behind HTTPS reverse proxy): RELAYWA_WEBHOOK_SECRET=... python relaywa_example.py
Do not use in-memory event processing as a durable production inbox.
"""
import hashlib
import hmac
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_API = "https://relaywa.com/api"


class UncertainSendError(Exception):
    """A transport timeout does NOT mean RelayWA failed to send."""


class RejectedSendError(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__(f"RelayWA rejected send with HTTP {status}; investigate before retry")


def send_order_update(*, session_key, to, order_id, api_base=DEFAULT_API, opener=urlopen):
    """Send once. Persist business event ID in the calling app for deduplication."""
    if not session_key:
        raise ValueError("Server-side session API key is required")
    if not api_base.startswith("https://") or api_base.endswith("/send-message"):
        raise ValueError("Require HTTPS API base, ending in /api")
    if not re.fullmatch(r"[0-9]{7,32}", to):
        raise ValueError("Recipient must be 7-32 international digits")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,75}", str(order_id)):
        raise ValueError("Invalid order identifier")
    event_key = f"order-{order_id}-ready-v1"
    payload = {
        "to": to, "text": f"Your order {order_id} is ready.",
        "clientMessageId": event_key,
    }
    request = Request(
        api_base.rstrip("/") + "/send-message",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + session_key,
                 "Content-Type": "application/json"},
        method="POST",
    )
    try:
        response = opener(request, timeout=30)
        with response:
            body = json.loads(response.read())
    except HTTPError as exc:
        raise RejectedSendError(exc.code) from None
    except (URLError, TimeoutError, OSError) as exc:
        raise UncertainSendError(
            f"Outcome uncertain for {event_key}; inspect status and reuse SAME key"
        ) from exc
    if not isinstance(body, dict) or body.get("success") is not True:
        raise RejectedSendError(getattr(response, "status", 200))
    return body.get("data")


def verify_webhook(raw_body, headers, secret, *, now_seconds=None, max_age=300):
    """HMAC-SHA256(secret, ascii timestamp + b'.' + RAW bytes), constant-time."""
    if not secret or not isinstance(raw_body, bytes):
        return False
    # Header names are case-insensitive in HTTP; normalise for testable callers.
    incoming = {str(k).lower(): str(v) for k, v in headers.items()}
    timestamp = incoming.get("x-relaywa-timestamp", "")
    signature = incoming.get("x-relaywa-signature", "")
    if not re.fullmatch(r"[0-9]{10}", timestamp):
        return False
    now = int(time.time()) if now_seconds is None else int(now_seconds)
    if abs(now - int(timestamp)) > max_age:
        return False
    if not re.fullmatch(r"sha256=[0-9a-fA-F]{64}", signature):
        return False
    expected = hmac.new(
        secret.encode("utf-8"), timestamp.encode("ascii") + b"." + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature[7:].lower())


def make_handler(secret, on_event, *, now_seconds=None):
    """Create an HTTP receiver; process idempotently only after HMAC succeeds."""
    if not secret or not callable(on_event):
        raise ValueError("Webhook secret and processor required")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            # Never log raw event content, authentication headers or QR credentials.
            pass

        def do_POST(self):
            if self.path != "/incoming-relaywa-webhook":
                self.send_error(404)
                return
            length_text = self.headers.get("Content-Length", "")
            if not length_text.isdigit() or int(length_text) > 1_000_000:
                self.send_error(413)
                return
            raw = self.rfile.read(int(length_text))
            if not verify_webhook(raw, self.headers, secret, now_seconds=now_seconds):
                self.send_error(401)
                return
            try:
                event = json.loads(raw)
                if not isinstance(event, dict) or not isinstance(event.get("id"), str) or not isinstance(event.get("type"), str):
                    raise ValueError("Invalid event")
            except (UnicodeError, ValueError):
                self.send_error(400)
                return
            try:
                # Production: insert id with UNIQUE index, store event and process
                # in a transaction. An in-memory set is NOT sufficient.
                on_event(event)
            except Exception:
                self.send_error(503)
                return
            self.send_response(204)
            self.end_headers()

    return Handler


if __name__ == "__main__":
    secret = os.environ.get("RELAYWA_WEBHOOK_SECRET", "")
    if not secret:
        raise SystemExit("Set RELAYWA_WEBHOOK_SECRET in your server environment")
    print("Listening on 127.0.0.1:3001 behind an HTTPS reverse proxy")
    HTTPServer(("127.0.0.1", 3001), make_handler(secret, lambda event: None)).serve_forever()
