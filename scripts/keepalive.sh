#!/bin/bash
# Keepalive script for Next.js dev server
# Restarts the server if it dies

cd /home/z/my-project

while true; do
  if ! kill -0 $(cat /tmp/dev.pid 2>/dev/null) 2>/dev/null; then
    echo "[$(date)] Starting dev server..." >> /tmp/keepalive.log
    npx next dev --port 3000 >> /tmp/dev-server.log 2>&1 &
    echo $! > /tmp/dev.pid
  fi
  sleep 3
done
