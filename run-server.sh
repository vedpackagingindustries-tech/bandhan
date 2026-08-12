#!/bin/bash
# Persistent Bandhan Production Server
# Keeps retrying if the process dies

STANDALONE_DIR="/home/z/my-project/.next/standalone"
LOG="/home/z/my-project/server.log"
PIDFILE="/home/z/my-project/server.pid"

# Ensure static files
if [ ! -d "$STANDALONE_DIR/.next/static" ] || [ -z "$(ls -A $STANDALONE_DIR/.next/static/chunks/*.css 2>/dev/null)" ]; then
  cp -r /home/z/my-project/.next/static "$STANDALONE_DIR/.next/static"
fi
if [ ! -d "$STANDALONE_DIR/public" ]; then
  cp -r /home/z/my-project/public "$STANDALONE_DIR/public"
fi

cd "$STANDALONE_DIR"
export NODE_ENV=production
export PORT=3000

echo "[$(date)] Starting Bandhan production server..." >> "$LOG"

while true; do
  node server.js >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 1s..." >> "$LOG"
  sleep 1
done
