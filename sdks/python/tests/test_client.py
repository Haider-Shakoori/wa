import json
import unittest
from unittest.mock import patch
from relaywa import RelayWA

class FakeResponse:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b'{}'

class ClientTests(unittest.TestCase):
    @patch('relaywa.urlopen')
    def test_send_text(self, mock_urlopen):
        mock_urlopen.return_value = FakeResponse()
        client = RelayWA('test-key')
        client.send_text('12025550123', 'Hello')
        req = mock_urlopen.call_args.args[0]
        self.assertEqual(req.full_url, 'https://relaywa.com/api/send-message')
        self.assertEqual(req.get_method(), 'POST')
        self.assertEqual(json.loads(req.data), {'to': '12025550123', 'text': 'Hello'})
        self.assertEqual(req.get_header('Authorization'), 'Bearer test-key')

    def test_rejects_invalid_inputs(self):
        with self.assertRaises(ValueError): RelayWA('')
        with self.assertRaises(ValueError): RelayWA('key', 'http://example.com/api')
        with self.assertRaises(ValueError): RelayWA('key').send_text('', 'Hello')

if __name__ == '__main__': unittest.main()
