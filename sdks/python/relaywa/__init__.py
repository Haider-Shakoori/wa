"""RelayWA server-side Python SDK preview. Never expose keys in client code."""
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlsplit

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
