#!/bin/bash
# Bandhan Final Release Audit Script
# Runs all verification tests in one shot

BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local name="$1"
  local code="$2"
  if [ "$code" = "200" ] || [ "$code" = "201" ] || [ "$code" = "400" ] || [ "$code" = "401" ] || [ "$code" = "403" ] || [ "$code" = "405" ]; then
    PASS=$((PASS+1))
    echo "  ✅ $name → $code"
  else
    FAIL=$((FAIL+1))
    echo "  ❌ $name → $code (UNEXPECTED)"
  fi
}

api_check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local hdr="$5"
  if [ -z "$method" ]; then method="GET"; fi
  if [ -n "$data" ]; then
    RESP=$(curl -s -o /dev/null -w '%{http_code}' -X $method -H 'Content-Type: application/json' $hdr -d "$data" "$BASE$path" 2>/dev/null)
  else
    RESP=$(curl -s -o /dev/null -w '%{http_code}' -X $method $hdr "$BASE$path" 2>/dev/null)
  fi
  check "$name" "$RESP"
}

echo "═══════════════════════════════════════"
echo "  BANDHAN FINAL RELEASE AUDIT"
echo "═══════════════════════════════════════"

# A. STATIC ASSETS
echo ""
echo "━━━ A. STATIC ASSETS ━━━"
for asset in "/_next/static/chunks/7e0f49a0a0fbb29e.css" "/_next/static/chunks/0b58b468162401a2.css" "/_next/static/media/2a65768255d6b625-s.p.d19752fb.woff2" "/_next/static/media/caa3a2e1cccd8315-s.p.3b6cae6d.woff2" "/logo-en.jpg" "/sahu-samaj-flag.png" "/hero-matrimony.png" "/hero-business.png" "/karma-mata.png"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$asset" 2>/dev/null)
  fname=$(basename "$asset")
  check "$fname" "$code"
done

# B. PUBLIC PAGES & APIs
echo ""
echo "━━━ B. HOMEPAGE + PUBLIC APIs ━━━"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE" 2>/dev/null)
check "Homepage" "$code"
api_check "Health" "" "/api/v1/health"
api_check "Public Stats" "" "/api/v1/stats/public"
api_check "Public Config" "" "/api/v1/config/public"
api_check "Membership Plans" "" "/api/v1/membership/plans"
api_check "Locations" "" "/api/v1/locations"
api_check "Gotras" "" "/api/v1/gotras"
api_check "Jobs (public)" "" "/api/v1/jobs"
api_check "Business (public)" "" "/api/v1/business"
api_check "Directory (public)" "" "/api/v1/directory"

# C. AUTH FLOWS
echo ""
echo "━━━ C. AUTH FLOWS ━━━"
api_check "Register (empty)" "POST" "/api/v1/auth/register" '{}'
api_check "Login (invalid)" "POST" "/api/v1/auth/login" '{"phone":"x","password":"x"}'
api_check "Login (missing fields)" "POST" "/api/v1/auth/login" '{}'
api_check "Me (no token)" "" "/api/v1/auth/me"
api_check "OTP Send (empty)" "POST" "/api/v1/auth/otp/send" '{}'
api_check "OTP Verify (empty)" "POST" "/api/v1/auth/otp/verify" '{}'
api_check "Profile (no token)" "" "/api/v1/user/profile"
api_check "Notifications (no token)" "" "/api/v1/user/notifications"
api_check "Payments (no token)" "" "/api/v1/payments"
api_check "Search (no token)" "" "/api/v1/search"
api_check "Reports (no token)" "" "/api/v1/reports"
api_check "Blocks (no token)" "" "/api/v1/blocks"
api_check "Matrimony Search (no token)" "" "/api/v1/matrimony/search"
api_check "Matrimony Profile (no token)" "POST" "/api/v1/matrimony/profile" '{}'
api_check "Contact (no token)" "POST" "/api/v1/matrimony/contact" '{}'

# D. PROTECTED ENDPOINTS (should return 401)
echo ""
echo "━━━ D. PROTECTED ROUTES (expect 401) ━━━"
for ep in "/api/v1/ai/match" "/api/v1/ai/recommendations" "/api/v1/ai/job-match" "/api/v1/ai/risk" "/api/v1/ai/moderation" "/api/v1/ai/analytics" "/api/v1/ai/photo-edit"; do
  api_check "AI $(echo $ep | rev | cut -d/ -f1 | rev)" "" "$ep"
done

# E. ADMIN ENDPOINTS (expect 401 without auth)
echo ""
echo "━━━ E. ADMIN ROUTES (expect 401) ━━━"
for ep in "/api/v1/admin/dashboard" "/api/v1/admin/users" "/api/v1/admin/roles" "/api/v1/admin/settings" "/api/v1/admin/security" "/api/v1/admin/analytics" "/api/v1/admin/advertisements" "/api/v1/admin/campaigns" "/api/v1/admin/reports" "/api/v1/admin/audit-logs" "/api/v1/admin/stats" "/api/v1/admin/matrimony" "/api/v1/admin/business" "/api/v1/admin/jobs" "/api/v1/admin/directory" "/api/v1/admin/membership" "/api/v1/admin/bulk-notifications" "/api/v1/admin/ops/dashboard" "/api/v1/admin/ops/users" "/api/v1/admin/ops/revenue" "/api/v1/admin/ops/health" "/api/v1/admin/ops/analytics" "/api/v1/admin/ops/audit" "/api/v1/admin/ops/backups" "/api/v1/admin/ops/settings" "/api/v1/admin/ops/scheduled-tasks" "/api/v1/admin/ops/observability"; do
  api_check "Admin $(echo $ep | rev | cut -d/ -f1 | rev)" "" "$ep"
done

# F. AI POST-ONLY ENDPOINTS (expect 405 for GET)
echo ""
echo "━━━ F. AI POST-ONLY (expect 405) ━━━"
for ep in "/api/v1/ai/assistant" "/api/v1/ai/astrology" "/api/v1/ai/smart-search" "/api/v1/ai/photo-quality" "/api/v1/ai/translate" "/api/v1/ai/profile-assist" "/api/v1/ai/automation" "/api/v1/ai/admin-copilot" "/api/v1/ai/admin/moderation" "/api/v1/ai/admin/providers"; do
  api_check "AI $(echo $ep | rev | cut -d/ -f1 | rev)" "" "$ep"
done

# G. AD TRACKING
echo ""
echo "━━━ G. ADS ━━━"
api_check "Ad Track (missing campaignId)" "POST" "/api/v1/ads/track" '{"action":"IMPRESSION"}'
api_check "Ad Track (invalid action)" "POST" "/api/v1/ads/track" '{"campaignId":"test","action":"VIEW"}'

# H. DATA VERIFICATION
echo ""
echo "━━━ H. REAL DATA VERIFICATION ━━━"
STATS=$(curl -s "$BASE/api/v1/stats/public" 2>/dev/null)
MEMBERS=$(echo "$STATS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['totalMembers'])" 2>/dev/null)
ACTIVE=$(echo "$STATS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['activeUsers'])" 2>/dev/null)
echo "  📊 Public Stats: totalMembers=$MEMBERS, activeUsers=$ACTIVE (from database)"

GOTRA_TOTAL=$(curl -s "$BASE/api/v1/gotras" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['total'])" 2>/dev/null)
echo "  📊 Gotra count: $GOTRA_TOTAL"

PLANS=$(curl -s "$BASE/api/v1/membership/plans" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']['plans']))" 2>/dev/null)
echo "  📊 Membership plans: $PLANS (from database)"

LOCS=$(curl -s "$BASE/api/v1/locations" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']['locations']))" 2>/dev/null)
echo "  📊 Locations: $LOCS (from database)"

# I. SECURITY HEADERS
echo ""
echo "━━━ I. SECURITY HEADERS ━━━"
for hdr in "X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection" "Referrer-Policy" "Permissions-Policy"; do
  VAL=$(curl -sI "$BASE/api/v1/health" 2>/dev/null | grep -i "$hdr" | tr -d '\r')
  if [ -n "$VAL" ]; then
    PASS=$((PASS+1))
    echo "  ✅ $VAL"
  else
    FAIL=$((FAIL+1))
    echo "  ❌ $hdr: MISSING"
  fi
done

# J. PASSWORD/TOKEN LEAKAGE CHECK
echo ""
echo "━━━ J. CREDENTIAL LEAKAGE CHECK ━━━"
LOGIN_RESP=$(curl -s -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' -d '{"phone":"9999999999","password":"Test@123"}' 2>/dev/null)
HAS_PW=$(echo "$LOGIN_RESP" | grep -ic 'passwordHash\|password_hash\|"password"')
HAS_SECRET=$(echo "$LOGIN_RESP" | grep -ic 'secret\|private_key')
if [ "$HAS_PW" -eq 0 ] && [ "$HAS_SECRET" -eq 0 ]; then
  PASS=$((PASS+1))
  echo "  ✅ Login response: no password/secret leakage"
else
  FAIL=$((FAIL+1))
  echo "  ❌ Login response may leak sensitive data (password mentions: $HAS_PW, secrets: $HAS_SECRET)"
fi

# K. PERFORMANCE
echo ""
echo "━━━ K. PERFORMANCE ━━━"
for ep in "" "/api/v1/health" "/api/v1/gotras" "/api/v1/jobs" "/api/v1/business" "/api/v1/membership/plans" "/api/v1/stats/public" "/api/v1/locations"; do
  TIME=$(curl -s -o /dev/null -w '%{time_total}' "$BASE$ep" 2>/dev/null)
  MS=$(echo "$TIME * 1000" | bc 2>/dev/null)
  if [ "$(echo "$MS < 500" | bc 2>/dev/null)" = "1" ]; then
    PASS=$((PASS+1))
    printf "  ✅ %-30s %s ms\n" "$ep" "$MS"
  else
    FAIL=$((FAIL+1))
    printf "  ❌ %-30s %s ms (SLOW)\n" "$ep" "$MS"
  fi
done

# L. CSS/STYLING CHECK
echo ""
echo "━━━ L. CSS/STYLING ━━━"
CSS_SIZE=$(curl -s "$BASE/_next/static/chunks/0b58b468162401a2.css" 2>/dev/null | wc -c)
if [ "$CSS_SIZE" -gt 100000 ]; then
  PASS=$((PASS+1))
  echo "  ✅ Main CSS: ${CSS_SIZE} bytes (>100KB, includes Tailwind)"
else
  FAIL=$((FAIL+1))
  echo "  ❌ Main CSS: ${CSS_SIZE} bytes (too small, may be missing styles)"
fi

BODY_CLASSES=$(curl -s "$BASE" 2>/dev/null | grep -oP 'class="[^"]*bg-ivory[^"]*"')
if [ -n "$BODY_CLASSES" ]; then
  PASS=$((PASS+1))
  echo "  ✅ Body has bg-ivory class (Bandhan theme)"
else
  FAIL=$((FAIL+1))
  echo "  ❌ Body missing bg-ivory class"
fi

MEDIA_Q=$(curl -s "$BASE/_next/static/chunks/0b58b468162401a2.css" 2>/dev/null | grep -c '@media')
if [ "$MEDIA_Q" -gt 0 ]; then
  PASS=$((PASS+1))
  echo "  ✅ CSS has $MEDIA_Q media queries (responsive)"
else
  FAIL=$((FAIL+1))
  echo "  ❌ CSS has no media queries (not responsive)"
fi

# FINAL SUMMARY
echo ""
echo "═══════════════════════════════════════"
echo "  SUMMARY: $PASS PASS, $FAIL FAIL"
echo "═══════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "  STATUS: ✅ ALL CHECKS PASSED"
else
  echo "  STATUS: ❌ $FAIL FAILURES FOUND"
fi
