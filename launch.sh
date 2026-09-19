#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-9999}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$DIR"

echo "Starting Asteroid Map on http://localhost:${PORT}"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 || true
fi

python3 app.py "$PORT"
