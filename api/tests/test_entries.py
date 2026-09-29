"""Run with: python -m unittest discover -s api/tests (requires httpx)."""
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

# Keep tests independent of local server configuration and credentials.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = ModuleType('config')
config.BASE_PATH = Path(__file__).resolve().parents[1]
config.config = SimpleNamespace(servers=[])
sys.modules['config'] = config

from main import app, RedisService
from models import RedisEntry


class EntriesPaginationTest(unittest.TestCase):
    def test_http_and_websocket_pages(self):
        entries = [RedisEntry(key=f'key:{i:04}', type='string', size=1, ttl=-1) for i in range(1201)]
        # Equal sort values and duplicate SCAN entries must not shift page boundaries.
        with patch.object(RedisService, 'get_entries', new=AsyncMock(return_value=entries[::-1] + entries[:5])) as scan:
            with TestClient(app) as client:
                params = {'server': 'test', 'database': 0, 'sort': 'size:asc', 'pattern': 'key:*'}
                pages = [client.get('/server/entries', params={**params, 'offset': offset}).json()
                         for offset in (0, 500, 1000, 1500)]
                self.assertEqual([len(page['items']) for page in pages], [500, 500, 201, 0])
                self.assertEqual([page['has_more'] for page in pages], [True, True, False, False])
                self.assertEqual([item['key'] for page in pages for item in page['items']],
                                 [entry.key for entry in entries])
                scan.assert_awaited_with('test', 0, 'key:*')
                descending = client.get('/server/entries', params={**params, 'sort': 'key:desc'}).json()
                self.assertEqual(descending['items'][0]['key'], 'key:1200')
                for invalid in ({'offset': -1}, {'limit': 0}, {'limit': 501}):
                    self.assertEqual(client.get('/server/entries', params={**params, **invalid}).status_code, 422)
                with client.websocket_connect('/ws') as ws:
                    ws.send_json({'id': '1', 'action': 'server:entries', 'payload': {**params, 'offset': 500}})
                    self.assertEqual(ws.receive_json()['data'], pages[1])
                    ws.send_json({'id': '2', 'action': 'server:entries', 'payload': {**params, 'limit': 501}})
                    self.assertIn('error', ws.receive_json()['data'])
                scan.return_value = []
                self.assertEqual(client.get('/server/entries', params=params).json(), {'items': [], 'has_more': False})
                scan.return_value = entries[:500]
                last = client.get('/server/entries', params=params).json()
                self.assertEqual(len(last['items']), 500)
                self.assertFalse(last['has_more'])


if __name__ == '__main__':
    unittest.main()
