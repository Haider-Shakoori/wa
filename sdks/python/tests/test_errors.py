import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from io import BytesIO
from relaywa import RelayWA, RelayWAError

class ErrorTests(unittest.TestCase):
    @patch('relaywa.urlopen')
    def test_http_error(self, open_mock):
        open_mock.side_effect = HTTPError('https://relaywa.com/api/send-message', 429, 'rate limited', {}, BytesIO(b'{}'))
        with self.assertRaisesRegex(RelayWAError, '429'):
            RelayWA('test-key').send_text('12025550123', 'hello')
        self.assertEqual(open_mock.call_count, 1)

    @patch('relaywa.urlopen')
    def test_network_error_propagates_without_retry(self, open_mock):
        open_mock.side_effect = OSError('network unavailable')
        with self.assertRaises(OSError):
            RelayWA('test-key').sessions()
        self.assertEqual(open_mock.call_count, 1)

if __name__ == '__main__': unittest.main()
