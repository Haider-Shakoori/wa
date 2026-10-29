import json
import unittest
from unittest.mock import patch
from relaywa import RelayWA

class FakeResponse:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b'{}'

MEDIA = {'to': '12025550123', 'url': 'https://example.com/photo.jpg', 'mimeType': 'image/jpeg', 'mediaSizeBytes': 1024}

class MediaTests(unittest.TestCase):
    @patch('relaywa.urlopen')
    def test_media_routes(self, mock_open):
        mock_open.return_value = FakeResponse()
        sdk = RelayWA('test-key')
        for kind in ('image', 'video', 'audio', 'document'):
            getattr(sdk, 'send_' + kind)(MEDIA)
            request = mock_open.call_args.args[0]
            self.assertEqual(request.full_url, 'https://relaywa.com/api/send-' + kind)
            self.assertEqual(request.get_header('Authorization'), 'Bearer test-key')
            self.assertEqual(json.loads(request.data), MEDIA)
        self.assertEqual(mock_open.call_count, 4)

    @patch('relaywa.urlopen')
    def test_rejects_bad_media_without_network(self, mock_open):
        sdk = RelayWA('test-key')
        for data in ({**MEDIA, 'url': 'http://example.com/a'},
                     {**MEDIA, 'mediaSizeBytes': 16777217},
                     {**MEDIA, 'mediaSizeBytes': 0},
                     {**MEDIA, 'to': ''}):
            with self.assertRaises(ValueError): sdk.send_image(data)
        self.assertEqual(mock_open.call_count, 0)

if __name__ == '__main__': unittest.main()
