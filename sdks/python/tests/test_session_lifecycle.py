import json
import unittest
from unittest.mock import patch
from relaywa import RelayWA

class FakeResponse:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b'{}'

class SessionLifecycleTests(unittest.TestCase):
    @patch('relaywa.urlopen')
    def test_session_mutation_routes(self, transport):
        transport.return_value = FakeResponse()
        sdk = RelayWA('offline-test')
        operations = [
            (lambda: sdk.create_session({'name': 'Demo'}), 'POST', '/whatsapp-sessions', {'name': 'Demo'}),
            (lambda: sdk.update_session('a/b', {'phoneHint': '123'}), 'PATCH', '/whatsapp-sessions/a%2Fb', {'phoneHint': '123'}),
            (lambda: sdk.connect_session('a/b'), 'POST', '/whatsapp-sessions/a%2Fb/connect', None),
            (lambda: sdk.restart_session('a/b'), 'POST', '/whatsapp-sessions/a%2Fb/restart', None),
            (lambda: sdk.disconnect_session('a/b'), 'POST', '/whatsapp-sessions/a%2Fb/disconnect', None),
            (lambda: sdk.delete_session('a/b'), 'DELETE', '/whatsapp-sessions/a%2Fb', None),
        ]
        for invoke, method, path, payload in operations:
            with self.subTest(path=path):
                invoke()
                req = transport.call_args.args[0]
                self.assertEqual(req.get_method(), method)
                self.assertEqual(req.full_url, 'https://relaywa.com/api' + path)
                self.assertEqual(req.get_header('Authorization'), 'Bearer offline-test')
                self.assertEqual(json.loads(req.data) if req.data else None, payload)

    @patch('relaywa.urlopen')
    def test_invalid_inputs_never_hit_transport(self, transport):
        sdk = RelayWA('offline-test')
        for invoke in [
            lambda: sdk.create_session({}),
            lambda: sdk.create_session({'name': 'x'}),
            lambda: sdk.update_session('id', {'phoneHint': 'x' * 41}),
            lambda: sdk.connect_session(' '),
            lambda: sdk.delete_session(''),
        ]:
            with self.assertRaises(ValueError):
                invoke()
        transport.assert_not_called()

if __name__ == '__main__':
    unittest.main()
