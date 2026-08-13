#!/bin/bash
# Bandhan v1.0.0 — Deployment ZIP Creator
set -euo pipefail

PROJECT_DIR="/home/z/my-project"
ZIP_NAME="bandhan-v1.0.0-deployment.zip"
ZIP_PATH="$PROJECT_DIR/$ZIP_NAME"
TMP_DIR="/tmp/bandhan-zip-$$"

rm -f "$ZIP_PATH"
mkdir -p "$TMP_DIR/bandhan"

cd "$PROJECT_DIR"

echo "[1/5] Copying source files..."
cp -r src/ "$TMP_DIR/bandhan/src/"
cp -r prisma/ "$TMP_DIR/bandhan/prisma/"
cp -r public/ "$TMP_DIR/bandhan/public/"

# Copy db/ directory (contains SQLite database)
cp -r db/ "$TMP_DIR/bandhan/db/"

echo "[2/5] Copying config files..."
cp package.json "$TMP_DIR/bandhan/"
cp bun.lock "$TMP_DIR/bandhan/" 2>/dev/null || echo "  (bun.lock not found, skipping)"
cp next.config.ts "$TMP_DIR/bandhan/"
cp tsconfig.json "$TMP_DIR/bandhan/"
cp postcss.config.mjs "$TMP_DIR/bandhan/"
cp tailwind.config.ts "$TMP_DIR/bandhan/"
cp components.json "$TMP_DIR/bandhan/"
cp eslint.config.mjs "$TMP_DIR/bandhan/"

echo "[3/5] Copying build/start scripts..."
# Create production start script
cat > "$TMP_DIR/bandhan/start-production.sh" << 'SCRIPT'
#!/bin/bash
set -euo pipefail
echo "=== Bandhan v1.0.0 — Production Start ==="
echo "[1/4] Installing dependencies..."
bun install --production 2>&1 | tail -1
echo "[2/4] Generating Prisma client..."
bunx prisma generate 2>&1 | tail -1
echo "[3/4] Running database setup..."
bun run db:push 2>&1 | tail -3
echo "[4/4] Starting production server..."
NODE_ENV=production bun .next/standalone/server.js
SCRIPT
chmod +x "$TMP_DIR/bandhan/start-production.sh"

# Create build script
cat > "$TMP_DIR/bandhan/build-production.sh" << 'SCRIPT'
#!/bin/bash
set -euo pipefail
echo "=== Bandhan v1.0.0 — Production Build ==="
bun install
bunx prisma generate
bun run build
echo "=== Build complete. Run ./start-production.sh to serve. ==="
SCRIPT
chmod +x "$TMP_DIR/bandhan/build-production.sh"

echo "[4/5] Cleaning excluded files..."
# Remove node_modules, .next, .git, logs, cache, temp
cd "$TMP_DIR/bandhan"
rm -rf node_modules/ .next/ .git/ .vercel/
rm -rf *.log tool-results/ scripts/ upload/ download/
rm -rf .zscripts/ .z-ai-config .claude/
rm -rf tests/ examples/ .DS_Store
rm -f dev.log server.log dev.out.log .env .env.* server.pid run-server.sh start-server.sh
rm -f -- --timeout

# Remove Caddyfile (platform-specific, not needed for deployment)
rm -f Caddyfile

echo "[5/5] Creating ZIP..."
cd "$TMP_DIR"
zip -r "$ZIP_PATH" bandhan/ -x "bandhan/node_modules/*" "bandhan/.next/*" "bandhan/.git/*"

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "=== DONE ==="
echo "ZIP: $ZIP_PATH"
echo "Size: $(du -sh "$ZIP_PATH" | cut -f1)"
echo "Contents:"
unzip -l "$ZIP_PATH" | tail -1
