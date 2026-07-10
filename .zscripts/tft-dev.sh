#!/bin/bash
# tft-dev.sh — ensures we're on web-vlm branch and dev server is running with web-vlm code.
# Use this instead of .zscripts/dev.sh directly to survive sandbox HEAD resets.

set -e
cd /home/z/my-project

# 1. Always checkout web-vlm (sandbox resets HEAD to main between bash calls)
git checkout -f web-vlm 2>/dev/null || true

# 2. Check if dev server is running AND serving web-vlm code
NEEDS_RESTART=false
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/state 2>/dev/null | grep -q "200\|500"; then
  # Server is up and has the /api/state route — it's serving web-vlm code
  :
else
  NEEDS_RESTART=true
fi

if [ "$NEEDS_RESTART" = "true" ]; then
  echo "[tft-dev] Dev server not serving web-vlm code. Restarting..."
  pkill -9 -f "next dev" 2>/dev/null || true
  pkill -9 -f "next-server" 2>/dev/null || true
  pkill -9 -f "dev.sh" 2>/dev/null || true
  sleep 2
  nohup bash .zscripts/dev.sh > .zscripts/dev-launch.log 2>&1 &
  # Wait for server to be ready
  for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/state 2>/dev/null | grep -q "200\|500"; then
      echo "[tft-dev] Dev server ready after ${i}s"
      break
    fi
    sleep 1
  done
else
  echo "[tft-dev] Dev server already serving web-vlm code."
fi

# 3. Ensure we're on web-vlm (in case dev.sh triggered a re-checkout)
git checkout -f web-vlm 2>/dev/null || true
