#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  node server.js 2>&1
  echo "[$(date +%H:%M:%S)] Restarting in 2s..."
  sleep 2
done
