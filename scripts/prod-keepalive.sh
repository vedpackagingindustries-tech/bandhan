#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  echo "[$(date +%H:%M:%S)] Starting production server..."
  node server.js 2>&1
  EXIT_CODE=$?
  echo "[$(date +%H:%M:%S)] Server exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
