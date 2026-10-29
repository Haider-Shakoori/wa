"""RelayWA server-side Python SDK preview. Never expose keys in client code."""
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlsplit, quote

class RelayWAError(Exception):
    pass

class RelayWA:
    def __init__(self, session_key: str, base_url: str = "https://relaywa.com/api"):
        if not session_key.strip():
            raise ValueError("session_key is required")
        if not base_url.startswith("https://"):
            raise ValueError("HTTPS API base required")
        self.session_key = session_key
        self.base_url = base_url.rstrip("/")

    def _request(self, method: str, path: str, payload=None):
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Authorization": f"Bearer {self.session_key}"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as exc:
            raise RelayWAError(f"RelayWA HTTP {exc.code}") from exc

    def send_text(self, to: str, text: str):
        if not to.strip() or not text.strip():
            raise ValueError("to and text required")
        return self._request("POST", "/send-message", {"to": to, "text": text})

    MEDIA_LIMITS = {"image": 16 * 1024 * 1024, "video": 64 * 1024 * 1024,
                    "audio": 16 * 1024 * 1024, "document": 100 * 1024 * 1024}

    def _send_media(self, kind: str, media: dict):
        to = media.get("to")
        url = media.get("url")
        mime = media.get("mimeType")
        size = media.get("mediaSizeBytes")
        if not isinstance(to, str) or not 7 <= len(to) <= 32 or not to.strip():
            raise ValueError("Invalid media recipient")
        if not isinstance(url, str):
            raise ValueError("Media URL must use HTTPS")
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Media URL must use HTTPS without credentials")
        if not isinstance(mime, str) or not mime.strip():
            raise ValueError("mimeType is required")
        if type(size) is not int or not 1 <= size <= self.MEDIA_LIMITS[kind]:
            raise ValueError("Invalid media size")
        return self._request("POST", "/send-" + kind, media)

    def send_image(self, media: dict):
        return self._send_media("image", media)

    def send_video(self, media: dict):
        return self._send_media("video", media)

    def send_audio(self, media: dict):
        return self._send_media("audio", media)

    def send_document(self, media: dict):
        return self._send_media("document", media)

    def sessions(self):
        return self._request("GET", "/whatsapp-sessions")

    def webhooks(self):
        return self._request("GET", "/webhooks")

    @staticmethod
    def _webhook_id(endpoint_id: str) -> str:
        if not isinstance(endpoint_id, str) or not endpoint_id.strip():
            raise ValueError("Webhook ID required")
        return quote(endpoint_id, safe="")

    @staticmethod
    def _validate_webhook(payload: dict, create: bool = False):
        if not isinstance(payload, dict):
            raise ValueError("Webhook payload required")
        if create and ("name" not in payload or "url" not in payload):
            raise ValueError("Webhook name and URL required")
        if "name" in payload and (not isinstance(payload["name"], str) or not 2 <= len(payload["name"]) <= 120):
            raise ValueError("Invalid webhook name")
        if "url" in payload:
            url = payload["url"]
            if not isinstance(url, str):
                raise ValueError("Webhook URL must use HTTPS")
            parsed = urlsplit(url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("Webhook URL must use HTTPS without credentials")
        if "eventTypes" in payload:
            events = payload["eventTypes"]
            if not isinstance(events, list) or len(events) > 32 or any(not isinstance(e, str) or len(e) > 64 for e in events):
                raise ValueError("Invalid webhook event types")
        if "enabled" in payload and type(payload["enabled"]) is not bool:
            raise ValueError("Webhook enabled must be boolean")

    def create_webhook(self, payload: dict):
        self._validate_webhook(payload, create=True)
        return self._request("POST", "/webhooks", payload)

    def update_webhook(self, endpoint_id: str, payload: dict):
        self._validate_webhook(payload)
        return self._request("PATCH", "/webhooks/" + self._webhook_id(endpoint_id), payload)

    def delete_webhook(self, endpoint_id: str):
        return self._request("DELETE", "/webhooks/" + self._webhook_id(endpoint_id))

    def webhook_deliveries(self, endpoint_id: str):
        return self._request("GET", "/webhooks/" + self._webhook_id(endpoint_id) + "/deliveries")
