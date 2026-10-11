"""Offline tests of contract-shaped sends, signatures and webhook responses."""
import hashlib
import hmac
import json
import socket
import threading
import unittest
from http.server import HTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from relaywa_example import (
    RejectedSendError, UncertainSendError, make_handler, send_order_update, verify_webhook,
)


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def read(self):
        return b'{"success":true,"data":{"id":"message-123","status":"sent"}}'


class ApiTests(unittest.TestCase):
    def test_send_uses_bearer_https_and_stable_event_id(self):
        calls = []

        def open_fake(request, timeout):
            calls.append((request, timeout))
            return FakeResponse()

        got = send_order_update(
            session_key="server-test-token", to="12025550123",
            order_id="123", opener=open_fake,
        )
        self.assertEqual(got["id"], "message-123")
        self.assertEqual(len(calls), 1)
        request, timeout = calls[0]
        self.assertEqual(request.full_url, "https://relaywa.com/api/send-message")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(json.loads(request.data)["clientMessageId"], "order-123-ready-v1")
        self.assertEqual(request.get_header("Authorization"), "Bearer server-test-token")
        self.assertEqual(timeout, 30)

    def test_disconnected_and_network_failures_never_retry(self):
        count = 0

        def disconnected(request, timeout):
            nonlocal count
            count += 1
            raise HTTPError(request.full_url, 409, "disconnected", {}, None)

        with self.assertRaises(RejectedSendError) as error:
            send_order_update(session_key="k", to="12025550123", order_id="7", opener=disconnected)
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(count, 1)

        def uncertain(request, timeout):
            nonlocal count
            count += 1
            raise URLError("socket closed")

        with self.assertRaisesRegex(UncertainSendError, "SAME key"):
            send_order_update(session_key="k", to="12025550123", order_id="7", opener=uncertain)
        self.assertEqual(count, 2)

    def test_validate_inputs(self):
        for recipient in ("+12025550123", "12 20", "123"):
            with self.assertRaises(ValueError):
                send_order_update(session_key="k", to=recipient, order_id="1")
        with self.assertRaises(ValueError):
            send_order_update(session_key="k", to="12025550123", order_id="1", api_base="http://localhost/api")


class WebhookTests(unittest.TestCase):
    SECRET = "fixture-secret"
    NOW = 1791378000

    @classmethod
    def signed(cls, raw):
        timestamp = str(cls.NOW)
        digest = hmac.new(cls.SECRET.encode(), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
        return {"X-RelayWA-Timestamp": timestamp, "X-RelayWA-Signature": "sha256=" + digest}

    def test_raw_bytes_timestamp_and_tamper(self):
        raw = b'{\n "id":"event-1", "type":"message.received" }'
        headers = self.signed(raw)
        self.assertTrue(verify_webhook(raw, headers, self.SECRET, now_seconds=self.NOW))
        self.assertFalse(verify_webhook(json.dumps(json.loads(raw)).encode(), headers, self.SECRET, now_seconds=self.NOW))
        self.assertFalse(verify_webhook(raw, headers, "wrong", now_seconds=self.NOW))
        self.assertFalse(verify_webhook(raw, headers, self.SECRET, now_seconds=self.NOW + 301))
        self.assertFalse(verify_webhook(raw, {**headers, "X-RelayWA-Signature": "bad"}, self.SECRET, now_seconds=self.NOW))
        self.assertFalse(verify_webhook(raw, {**headers, "X-RelayWA-Timestamp": "nope"}, self.SECRET, now_seconds=self.NOW))

    def test_http_receiver_rejects_bad_signatures_and_processing_failures(self):
        seen = []
        handler = make_handler(self.SECRET, lambda e: seen.append(e), now_seconds=self.NOW)
        server = HTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        raw = b'{"id":"event-1","type":"message.received","data":{}}'
        url = f"http://127.0.0.1:{server.server_port}/incoming-relaywa-webhook"
        try:
            def post(headers):
                return urlopen(Request(url, data=raw, headers=headers, method="POST"), timeout=3)

            with post(self.signed(raw)) as response:
                self.assertEqual(response.status, 204)
            with self.assertRaises(HTTPError) as error:
                post({"X-RelayWA-Timestamp": str(self.NOW), "X-RelayWA-Signature": "sha256=" + "a" * 64})
            self.assertEqual(error.exception.code, 401)
            self.assertEqual(len(seen), 1)
        finally:
            server.shutdown()
            thread.join(timeout=3)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
