#!/bin/bash
# ═══════════════════════════════════════════════════════════
# BANDHAN — One-command production deployment
# Requires: vercel CLI + login (npx vercel login) OR VERCEL_TOKEN env var
# Deploys the CURRENT directory to the EXISTING Vercel project.
# ═══════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."

if [ -n "$VERCEL_TOKEN" ]; then
  npx vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
  npm run build
  npx vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"
else
  npx vercel pull --yes --environment=production
  npm run build
  npx vercel deploy --prebuilt --prod
fi

echo "✅ Deployed. Verifying..."
sleep 20
curl -s -o /dev/null -w "Homepage: %{http_code}\n" -A "Mozilla/5.0" "https://bandhan-sahu-connect.vercel.app/"
curl -s -o /dev/null -w "Pricing API: %{http_code}\n" -A "Mozilla/5.0" "https://bandhan-sahu-connect.vercel.app/api/v1/pricing"
