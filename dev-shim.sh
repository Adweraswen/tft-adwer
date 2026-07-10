#!/bin/bash
# Persistent dev server launcher — survives parent shell exit.
# Used because bash tool's process tree gets killed between calls.
cd /home/z/my-project
exec env NODE_OPTIONS="--max-old-space-size=1200" setsid \
  node node_modules/next/dist/bin/next dev -p 3000 \
  > /home/z/my-project/dev.log 2>&1 < /dev/null
