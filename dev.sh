#!/bin/bash
# dev.sh — one-command local test server.
# Serves the current directory over HTTP so the game runs at http://localhost:8000/
# (needed because GLTFLoader / fetch of GLB files fails under file:// due to
# same-origin restrictions in most browsers).
#
# Usage:
#   ./dev.sh          # start server on :8000, open browser, block until Ctrl+C
#   PORT=9000 ./dev.sh
#
# Ctrl+C or `kill $(lsof -ti :8000)` to stop.

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
URL="http://localhost:${PORT}/"

# Kill any stale server bound to this port so a repeated `./dev.sh` doesn't
# collide (common when the previous run was closed with a hard-kill).
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "[dev.sh] port ${PORT} in use — killing prior process"
  lsof -ti :"$PORT" | xargs kill -9 || true
  sleep 0.3
fi

echo "[dev.sh] serving $(pwd) at ${URL}"
python3 -m http.server "$PORT" >/dev/null &
SERVER_PID=$!

# Give http.server a beat to bind before we open the browser.
sleep 0.5

# Best-effort browser open (macOS `open`; falls through silently on other OSes).
open "${URL}" 2>/dev/null || echo "[dev.sh] visit ${URL} manually"

echo "[dev.sh] server PID ${SERVER_PID} — Ctrl+C to stop"
trap "kill ${SERVER_PID} 2>/dev/null || true" EXIT INT TERM
wait "${SERVER_PID}"
