#!/bin/bash
# Bandhan Preview Render Test - must run in single execution

cd /home/z/my-project

# Kill any existing server
pkill -f 'server.js' 2>/dev/null
sleep 2

# Start production server
cd /home/z/my-project/.next/standalone
NODE_ENV=production node server.js > /home/z/my-project/server.log 2>&1 &
SRV_PID=$!
sleep 4

# Verify server is running
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
echo "Server HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  echo "SERVER FAILED TO START"
  exit 1
fi

# Set desktop viewport
agent-browser set viewport 1920 1080

# Open page
agent-browser open http://localhost:3000/
sleep 6

# Skip intro by setting localStorage and reloading
agent-browser eval 'localStorage.setItem("bandhan-intro-seen","1"); location.reload();'
sleep 6

# Screenshot desktop
agent-browser screenshot /home/z/my-project/download/preview-main-desktop.png
echo "Desktop screenshot saved"
agent-browser get title

# Check for errors
echo "=== DESKTOP ERRORS ==="
agent-browser errors

# Mobile viewport
echo "=== MOBILE TEST ==="
agent-browser set viewport 375 812
agent-browser open http://localhost:3000/
sleep 5
agent-browser eval 'localStorage.setItem("bandhan-intro-seen","1"); location.reload();'
sleep 5
agent-browser screenshot /home/z/my-project/download/preview-main-mobile.png
echo "Mobile screenshot saved"
agent-browser get title
echo "=== MOBILE ERRORS ==="
agent-browser errors

# Test Caddy proxy
echo "=== CADDY PROXY TEST ==="
agent-browser set viewport 1920 1080
agent-browser open http://localhost:81/
sleep 5
agent-browser eval 'localStorage.setItem("bandhan-intro-seen","1"); location.reload();'
sleep 5
agent-browser screenshot /home/z/my-project/download/preview-caddy-desktop.png
echo "Caddy screenshot saved"
agent-browser get title
echo "=== CADDY ERRORS ==="
agent-browser errors

# Test hash routing
echo "=== HASH ROUTING TEST ==="
agent-browser open http://localhost:3000/#matrimony
sleep 4
agent-browser eval 'localStorage.setItem("bandhan-intro-seen","1"); location.reload();'
sleep 4
agent-browser screenshot /home/z/my-project/download/preview-matrimony.png
echo "Matrimony screenshot saved"
agent-browser get title

agent-browser open http://localhost:3000/#business
sleep 4
agent-browser screenshot /home/z/my-project/download/preview-business.png
echo "Business screenshot saved"
agent-browser get title

agent-browser open http://localhost:3000/#admin
sleep 3
agent-browser screenshot /home/z/my-project/download/preview-admin.png
echo "Admin screenshot saved"
agent-browser get title

agent-browser close

# File sizes
echo "=== SCREENSHOT SIZES ==="
ls -la /home/z/my-project/download/preview-*.png

# Cleanup
kill $SRV_PID 2>/dev/null
echo "=== ALL TESTS COMPLETE ==="