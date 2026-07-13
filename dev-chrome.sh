#!/bin/bash
# dev-chrome.sh — open a throwaway Chrome instance with file:// access enabled.
#
# WHEN TO USE THIS INSTEAD OF ./dev.sh:
#   * You want to double-click index.html and just play, no server.
#   * You're offline and can't hit a CDN anyway.
#   * Testing embedded-asset loading behaviour that changes with file://.
#
# WHEN NOT TO USE:
#   * Normal dev — use `./dev.sh` (real HTTP server) instead. Most browsers
#     enforce file:// same-origin restrictions that break fetch() of local
#     GLBs, and Chrome's --allow-file-access-from-files is a security
#     concession that we only want on a THROWAWAY profile.
#
# What this script does:
#   1. Creates a temp Chrome profile so we never touch your real profile.
#   2. Launches Chrome pointed at index.html with the file:// bypass flag.
#   3. Waits for you to close it, then deletes the temp profile.
#
# The flag is limited to this transient profile only — your normal Chrome
# is unaffected. This does NOT persist across restarts.

set -euo pipefail
cd "$(dirname "$0")"

CHROME_APP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME_APP" ]; then
  echo "[dev-chrome.sh] Google Chrome not found at $CHROME_APP" >&2
  echo "[dev-chrome.sh] Install Chrome or use ./dev.sh (HTTP server) instead." >&2
  exit 1
fi

PROFILE_DIR="$(mktemp -d -t chrome-simba.XXXXXX)"
INDEX_URL="file://$(pwd)/index.html"

echo "[dev-chrome.sh] temp profile:  $PROFILE_DIR"
echo "[dev-chrome.sh] opening:       $INDEX_URL"

trap "rm -rf '$PROFILE_DIR'" EXIT INT TERM

"$CHROME_APP" \
  --user-data-dir="$PROFILE_DIR" \
  --allow-file-access-from-files \
  --no-first-run \
  --no-default-browser-check \
  "$INDEX_URL"

# --allow-file-access-from-files: lets fetch() read local GLB assets.
# --no-first-run + --no-default-browser-check: skip Chrome's welcome dialogs.
# Chrome exits when you close all its windows; the trap then cleans up.
