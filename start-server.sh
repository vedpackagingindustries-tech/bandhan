#!/bin/bash
# Bandhan Production Server Startup
# Copies static assets (required for standalone mode) and starts the server

cd /home/z/my-project/.next/standalone

# Ensure static files are linked (Next.js standalone doesn't include these automatically)
if [ ! -d ".next/static" ] || [ -z "$(ls -A .next/static/chunks/*.css 2>/dev/null)" ]; then
  cp -r /home/z/my-project/.next/static .next/static
fi

if [ ! -d "public" ]; then
  cp -r /home/z/my-project/public public
fi

export NODE_ENV=production
export PORT=${PORT:-3000}
exec node server.js
