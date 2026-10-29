"""RelayWA server-side Python SDK preview. Never expose keys in client code."""
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

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

    def sessions(self):
        return self._request("GET", "/whatsapp-sessions")

    def webhooks(self):
        return self._request("GET", "/webhooks")
