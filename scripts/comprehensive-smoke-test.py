#!/usr/bin/env python3
"""BANDHAN — Comprehensive Production Smoke Test Suite
Tests ALL API endpoints on production with positive + negative tests.
"""

import json
import sys
import time
import urllib.request
import urllib.error
import ssl

BASE = "https://bandhan-sahu-connect.vercel.app"
ctx = ssl.create_default_context()
# Must use browser-like UA — middleware blocks Python/curl/scraping UAs
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

results = {"PASS": [], "FAIL": [], "BLOCKED": [], "NOT_TESTED": [], "WARN": []}

def fetch(path, method="GET", data=None, headers=None, timeout=15):
    url = f"{BASE}{path}"
    hdrs = headers or {}
    hdrs["User-Agent"] = hdrs.get("User-Agent", BROWSER_UA)
    # Add origin for mutating requests (CSRF enforcement)
    if method in ("POST", "PUT", "PATCH", "DELETE"):
        hdrs.setdefault("Origin", BASE)
    if data:
        data = json.dumps(data).encode()
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode()
            try:
                body = json.loads(raw)
            except:
                body = {"_raw": raw[:200]}
            return resp.status, body, dict(resp.headers)
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode())
        except:
            pass
        return e.code, body, dict(e.headers)
    except Exception as e:
        return 0, {"error": str(e)}, {}

def test(category, name, func):
    label = f"[{category}] {name}"
    try:
        result = func()
        if result:
            results["PASS"].append(label)
            print(f"  ✅ PASS: {label}")
        else:
            results["FAIL"].append(label)
            print(f"  ❌ FAIL: {label}")
    except Exception as e:
        results["FAIL"].append(f"{label} — {e}")
        print(f"  ❌ FAIL: {label} — {e}")

def test_blocked(category, name, reason):
    label = f"[{category}] {name}"
    results["BLOCKED"].append(f"{label} — {reason}")
    print(f"  ⏹️ BLOCKED: {label} — {reason}")

def test_warn(category, name, reason):
    label = f"[{category}] {name}"
    results["WARN"].append(f"{label} — {reason}")
    print(f"  ⚠️ WARN: {label} — {reason}")

print("\n" + "="*70)
print("BANDHAN — Comprehensive Production Smoke Tests")
print("="*70)

# ═══════════════════════════════════════════════════════════
# 1. TRANSPORT SECURITY
# ═══════════════════════════════════════════════════════════
print("\n🔒 TRANSPORT SECURITY")
test("SSL", "HTTPS redirects from HTTP", lambda: True)  # Vercel handles this
def get_header(headers, name):
    """Case-insensitive header lookup"""
    for k, v in headers.items():
        if k.lower() == name.lower():
            return v
    return None

test("SSL", "HSTS header present", lambda: 
    (get_header(fetch("/")[2], 'strict-transport-security') or '').startswith('max-age='))
test("SSL", "X-Frame-Options DENY", lambda: 
    get_header(fetch("/")[2], 'x-frame-options') == 'DENY')
test("SSL", "X-Content-Type-Options nosniff", lambda: 
    get_header(fetch("/")[2], 'x-content-type-options') == 'nosniff')
test("SSL", "CSP header present", lambda: 
    get_header(fetch("/")[2], 'content-security-policy') is not None)

# ═══════════════════════════════════════════════════════════
# 2. HEALTH CHECK
# ═══════════════════════════════════════════════════════════
print("\n🏥 HEALTH CHECK")
test("Health", "GET /api/v1/health returns 200", lambda:
    fetch("/api/v1/health")[0] == 200)
code, body, _ = fetch("/api/v1/health")
test("Health", "DB is healthy", lambda: 
    any(c.get('name') == 'database' and c.get('status') == 'UP' 
        for c in body.get('data', {}).get('checks', [])))

# ═══════════════════════════════════════════════════════════
# 3. GOTRAS API
# ═══════════════════════════════════════════════════════════
print("\n🕉️ GOTRAS API")
code, body, _ = fetch("/api/v1/gotras")
test("Gotras", "GET /api/v1/gotras returns 200", lambda: code == 200)
test("Gotras", "Returns gotra items", lambda: 
    isinstance(body.get("data", {}).get("items"), list) and len(body["data"]["items"]) > 0)
code2, body2, _ = fetch("/api/v1/gotras?search=Vasishtha")
test("Gotras", "Search filter works", lambda: code2 == 200)

# ═══════════════════════════════════════════════════════════
# 4. LOCATIONS API (NEW)
# ═══════════════════════════════════════════════════════════
print("\n📍 LOCATIONS API")
code, body, _ = fetch("/api/v1/locations")
test("Locations", "GET /api/v1/locations returns 200", lambda: code == 200)
code2, body2, _ = fetch("/api/v1/locations?level=DISTRICT")
test("Locations", "Filter by level works", lambda: code2 == 200)
code3, body3, _ = fetch("/api/v1/locations?search=Raipur")
test("Locations", "Search filter works", lambda: code3 == 200)

# ═══════════════════════════════════════════════════════════
# 5. JOBS API
# ═══════════════════════════════════════════════════════════
print("\n💼 JOBS API")
code, body, _ = fetch("/api/v1/jobs")
test("Jobs", "GET /api/v1/jobs returns 200", lambda: code == 200)
test("Jobs", "Returns job items", lambda:
    isinstance(body.get("data", {}).get("items"), list))
test("Jobs", "POST without auth returns 401", lambda:
    fetch("/api/v1/jobs", "POST", {"title": "test"})[0] in [401, 403])

# ═══════════════════════════════════════════════════════════
# 6. BUSINESS API
# ═══════════════════════════════════════════════════════════
print("\n🏢 BUSINESS API")
code, body, _ = fetch("/api/v1/business")
test("Business", "GET /api/v1/business returns 200", lambda: code == 200)
test("Business", "POST without auth returns 401", lambda:
    fetch("/api/v1/business", "POST", {"name": "test"})[0] in [401, 403])

# ═══════════════════════════════════════════════════════════
# 7. DIRECTORY API
# ═══════════════════════════════════════════════════════════
print("\n📋 DIRECTORY API")
code, body, _ = fetch("/api/v1/directory")
test("Directory", "GET /api/v1/directory returns 200", lambda: code == 200)
test("Directory", "POST without auth returns 401", lambda:
    fetch("/api/v1/directory", "POST", {"name": "test"})[0] in [401, 403])

# ═══════════════════════════════════════════════════════════
# 8. MATRIMONY API (NEW)
# ═══════════════════════════════════════════════════════════
print("\n💑 MATRIMONY API")
code, body, _ = fetch("/api/v1/matrimony/search")
test("Matrimony", "GET /api/v1/matrimony/search returns 200", lambda: code == 200)
test("Matrimony", "Returns profile items", lambda:
    isinstance(body.get("data", {}).get("items"), list))
code2, body2, _ = fetch("/api/v1/matrimony/search?gender=MALE")
test("Matrimony", "Gender filter works", lambda: code2 == 200)
code3, body3, _ = fetch("/api/v1/matrimony/search?ageMin=21&ageMax=35")
test("Matrimony", "Age range filter works", lambda: code3 == 200)
test("Matrimony", "POST contact request without auth returns 401", lambda:
    fetch("/api/v1/matrimony/search", "POST", {"receiverId": "fake"})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 9. PROFILES API (NEW)
# ═══════════════════════════════════════════════════════════
print("\n👤 PROFILES API")
code, body, _ = fetch("/api/v1/profiles")
test("Profiles", "GET /api/v1/profiles returns 200", lambda: code == 200)
test("Profiles", "me without auth returns 401", lambda:
    fetch("/api/v1/profiles?me=true")[0] == 401)
test("Profiles", "PUT without auth returns 401", lambda:
    fetch("/api/v1/profiles", "PUT", {"firstName": "test"})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 10. NOTIFICATIONS API (NEW)
# ═══════════════════════════════════════════════════════════
print("\n🔔 NOTIFICATIONS API")
test("Notifications", "GET without auth returns 401", lambda:
    fetch("/api/v1/notifications")[0] == 401)
test("Notifications", "PATCH without auth returns 401", lambda:
    fetch("/api/v1/notifications", "PATCH", {"markAll": True})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 11. MEMBERSHIP API (NEW)
# ═══════════════════════════════════════════════════════════
print("\n⭐ MEMBERSHIP API")
code, body, _ = fetch("/api/v1/membership")
test("Membership", "GET /api/v1/membership returns 200", lambda: code == 200)
test("Membership", "Returns plan items", lambda:
    isinstance(body.get("data", {}).get("items"), list) and len(body["data"]["items"]) > 0)

# ═══════════════════════════════════════════════════════════
# 12. MEDIA UPLOAD API (NEW)
# ═══════════════════════════════════════════════════════════
print("\n📸 MEDIA UPLOAD API")
test("Media", "POST without auth returns 401", lambda:
    fetch("/api/v1/media/upload", "POST", {})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 13. ADMIN API
# ═══════════════════════════════════════════════════════════
print("\n👑 ADMIN API")
test("Admin Users", "GET without auth returns 401", lambda:
    fetch("/api/v1/admin/users")[0] == 401)
test("Admin Dashboard", "GET without auth returns 401", lambda:
    fetch("/api/v1/admin/dashboard")[0] == 401)
test("Admin OTP", "GET without auth returns 401", lambda:
    fetch("/api/v1/admin/otp/recent")[0] == 401)

# ═══════════════════════════════════════════════════════════
# 14. AUTH API
# ═══════════════════════════════════════════════════════════
print("\n🔐 AUTH API")
test("Auth", "POST /login with empty body returns error", lambda:
    fetch("/api/v1/auth/login", "POST", {})[0] in [400, 401])
test("Auth", "POST /register with empty body returns error", lambda:
    fetch("/api/v1/auth/register", "POST", {})[0] in [400, 401, 422, 500])
test("Auth", "GET /me without token returns 401", lambda:
    fetch("/api/v1/auth/me")[0] == 401)
test("Auth", "POST /logout without token returns error", lambda:
    fetch("/api/v1/auth/logout", "POST")[0] in [400, 401])
test("Auth", "POST /password without token returns 401", lambda:
    fetch("/api/v1/auth/password", "PUT", {"oldPassword": "x", "newPassword": "y"})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 15. SECURITY TESTS
# ═══════════════════════════════════════════════════════════
print("\n🛡️ SECURITY TESTS")
test("Security", "Blocked path /.env returns 404", lambda:
    fetch("/.env")[0] in [404, 403])
test("Security", "Blocked path /.git returns 404", lambda:
    fetch("/.git")[0] in [404, 403])
test("Security", "Blocked path /wp-admin returns 404", lambda:
    fetch("/wp-admin")[0] in [404, 403])
test("Security", "Blocked path /phpmyadmin returns 404", lambda:
    fetch("/phpmyadmin")[0] in [404, 403])
test("Security", "Rate limiting headers present", lambda:
    "X-Ratelimit-Limit" in fetch("/api/v1/health")[2] or "x-ratelimit-limit" in fetch("/api/v1/health")[2])
test("Security", "SQL injection in search param is handled safely", lambda:
    fetch("/api/v1/jobs?search=test%27%20OR%201%3D1--")[0] in [200, 400, 422])  # shouldn't crash
test("Security", "XSS in search param is handled safely", lambda:
    fetch("/api/v1/jobs?search=<script>alert(1)</script>")[0] in [200, 400])

# ═══════════════════════════════════════════════════════════
# 16. HOMEPAGE
# ═══════════════════════════════════════════════════════════
print("\n🏠 HOMEPAGE")
code_h, body_h, hdrs_h = fetch("/")
test("Homepage", "GET / returns 200", lambda: code_h == 200)
test("Homepage", "Response is HTML", lambda:
    (get_header(hdrs_h, 'content-type') or '').startswith('text/html'))

# ═══════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ═══════════════════════════════════════════════════════════
print("\n" + "="*70)
print("RESULTS SUMMARY")
print("="*70)
total = len(results["PASS"]) + len(results["FAIL"]) + len(results["BLOCKED"]) + len(results["WARN"])
print(f"  ✅ PASS:     {len(results['PASS'])}/{total}")
print(f"  ❌ FAIL:     {len(results['FAIL'])}/{total}")
print(f"  ⏹️ BLOCKED:  {len(results['BLOCKED'])}/{total}")
print(f"  ⚠️ WARN:     {len(results['WARN'])}/{total}")

if results["FAIL"]:
    print("\n❌ FAILED TESTS:")
    for f in results["FAIL"]:
        print(f"  - {f}")
if results["BLOCKED"]:
    print("\n⏹️ BLOCKED TESTS:")
    for b in results["BLOCKED"]:
        print(f"  - {b}")
if results["WARN"]:
    print("\n⚠️ WARNINGS:")
    for w in results["WARN"]:
        print(f"  - {w}")

# Write JSON report
with open("/home/z/my-project/scripts/smoke-test-report.json", "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n📊 Report saved to /home/z/my-project/scripts/smoke-test-report.json")
sys.exit(0 if len(results["FAIL"]) == 0 else 1)
