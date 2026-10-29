import json
import unittest
from unittest.mock import patch
from relaywa import RelayWA

class FakeResponse:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b'{}'

class ReadOnlyTests(unittest.TestCase):
    @patch('relaywa.urlopen')
    def test_sessions_and_webhooks(self, mock_open):
        mock_open.return_value = FakeResponse()
        client = RelayWA('test-key')
        client.sessions()
        first = mock_open.call_args.args[0]
        self.assertEqual(first.full_url, 'https://relaywa.com/api/whatsapp-sessions')
        self.assertEqual(first.get_method(), 'GET')
        client.webhooks()
        second = mock_open.call_args.args[0]
        self.assertEqual(second.full_url, 'https://relaywa.com/api/webhooks')
        self.assertEqual(second.get_header('Authorization'), 'Bearer test-key')

if __name__ == '__main__': unittest.main()
