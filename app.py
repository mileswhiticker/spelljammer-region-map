#!/usr/bin/env python3
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / 'data' / 'encounter-state.json'


class AsteroidMapHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == '/api/encounter-state':
            self._send_json(self._read_state())
            return
        return super().do_GET()

    def do_PUT(self):
        if self.path == '/api/encounter-state':
            try:
                length = int(self.headers.get('Content-Length', '0'))
                payload = self.rfile.read(length)
                data = json.loads(payload.decode('utf-8'))
            except (ValueError, TypeError, json.JSONDecodeError):
                self.send_error(400, 'Invalid JSON payload')
                return

            random_encounter_enabled = data.get('randomEncounterEnabled', '1')
            state = {'randomEncounterEnabled': str(random_encounter_enabled)}

            try:
                STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
                with STATE_FILE.open('w', encoding='utf-8') as handle:
                    json.dump(state, handle, indent=2)
                    handle.write('\n')
            except OSError as exc:
                self.send_error(500, f'Failed to write state file: {exc}')
                return

            self._send_json(state)
            return

        self.send_error(405, 'Method not allowed')

    def _read_state(self):
        try:
            with STATE_FILE.open('r', encoding='utf-8') as handle:
                data = json.load(handle)
        except (FileNotFoundError, json.JSONDecodeError):
            default_state = {'randomEncounterEnabled': '1'}
            with STATE_FILE.open('w', encoding='utf-8') as handle:
                json.dump(default_state, handle, indent=2)
                handle.write('\n')
            return default_state

        return {
            'randomEncounterEnabled': str(data.get('randomEncounterEnabled', '1')),
        }

    def _send_json(self, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9999
    server = ThreadingHTTPServer(('0.0.0.0', port), AsteroidMapHandler)
    print(f'Serving Asteroid Map on http://localhost:{port}')
    server.serve_forever()
