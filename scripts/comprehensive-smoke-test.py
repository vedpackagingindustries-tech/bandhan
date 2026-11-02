#!/usr/bin/env python3
"""BANDHAN — Full Production Smoke Test Suite v2
Tests ALL API endpoints on production with positive + negative tests.
Includes: transport security, health, all CRUD APIs, auth, admin,
media upload, CORS preflight, rate limiting, security hardening.
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

import subprocess

_last_request_time = [0.0]

def fetch(path, method="GET", data=None, headers=None, timeout=20):
    """Fetch via curl — Python TLS fingerprint triggers Vercel Security Checkpoint."""
    url = f"{BASE}{path}"
    hdrs = ["-H", f"User-Agent: {BROWSER_UA}"]
    if method in ("POST", "PUT", "PATCH", "DELETE"):
        hdrs += ["-H", f"Origin: {BASE}"]
    hdrs += ["-H", "Content-Type: application/json"]
    if headers:
        for k, v in headers.items():
            if v is not None:
                hdrs += ["-H", f"{k}: {v}"]
    cmd = ["curl", "-s", "-D", "-", "-X", method, *hdrs, url, "--max-time", str(timeout)]
    if data:
        cmd += ["-d", json.dumps(data)]
    # Pacing to stay under 100 req/min edge rate limit
    now = time.time()
    elapsed = now - _last_request_time[0]
    if elapsed < 0.65:
        time.sleep(0.65 - elapsed)
    _last_request_time[0] = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        raw = proc.stdout
        if "\r\n\r\n" in raw:
            header_block, body_raw = raw.split("\r\n\r\n", 1)
        elif "\n\n" in raw:
            header_block, body_raw = raw.split("\n\n", 1)
        else:
            header_block, body_raw = raw, ""
        status = 0
        for line in header_block.split("\n"):
            if line.startswith("HTTP/") and " " in line:
                try:
                    status = int(line.split(" ")[1])
                except (ValueError, IndexError):
                    pass
        resp_headers = {}
        for line in header_block.split("\n")[1:]:
            if ":" in line:
                k, _, v = line.partition(":")
                resp_headers[k.strip()] = v.strip()
        try:
            body = json.loads(body_raw)
        except Exception:
            body = {"_raw": body_raw[:200]}
        return status, body, resp_headers
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

def test_warn(category, name, reason):
    label = f"[{category}] {name}"
    results["WARN"].append(f"{label} — {reason}")
    print(f"  ⚠️ WARN: {label} — {reason}")

def get_header(headers, name):
    """Case-insensitive header lookup"""
    for k, v in headers.items():
        if k.lower() == name.lower():
            return v
    return None

print("\n" + "="*70)
print("BANDHAN — Full Production Smoke Tests v2")
print("="*70)

# ═══════════════════════════════════════════════════════════
# 1. TRANSPORT SECURITY
# ═══════════════════════════════════════════════════════════
print("\n🔒 TRANSPORT SECURITY")
test("SSL", "HSTS header present", lambda: 
    (get_header(fetch("/")[2], 'strict-transport-security') or '').startswith('max-age='))
test("SSL", "X-Frame-Options DENY", lambda: 
    get_header(fetch("/")[2], 'x-frame-options') == 'DENY')
test("SSL", "X-Content-Type-Options nosniff", lambda: 
    get_header(fetch("/")[2], 'x-content-type-options') == 'nosniff')
test("SSL", "CSP header present", lambda: 
    get_header(fetch("/")[2], 'content-security-policy') is not None)
test("SSL", "X-Powered-By header removed (no server leak)", lambda:
    get_header(fetch("/api/v1/health")[2], 'x-powered-by') is None)
test("SSL", "Referrer-Policy set", lambda:
    get_header(fetch("/")[2], 'referrer-policy') is not None)
test("SSL", "Permissions-Policy set", lambda:
    get_header(fetch("/")[2], 'permissions-policy') is not None)

# ═══════════════════════════════════════════════════════════
# 2. HEALTH CHECK
# ═══════════════════════════════════════════════════════════
print("\n🏥 HEALTH CHECK")
code, body, _ = fetch("/api/v1/health")
test("Health", "GET /api/v1/health returns 200", lambda: code == 200)
test("Health", "Overall status is HEALTHY", lambda: body.get("data", {}).get("status") == "HEALTHY")
test("Health", "DB is healthy", lambda: 
    any(c.get('name') == 'database' and c.get('status') == 'UP' 
        for c in body.get('data', {}).get('checks', [])))
test("Health", "Cache is healthy", lambda:
    any(c.get('name') == 'cache' and c.get('status') == 'UP'
        for c in body.get('data', {}).get('checks', [])))
test("Health", "Queue is healthy", lambda:
    any(c.get('name') == 'job_queue' and c.get('status') == 'UP'
        for c in body.get('data', {}).get('checks', [])))
test("Health", "Version is reported", lambda:
    body.get('data', {}).get('version') is not None)

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
# 4. LOCATIONS API
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
test("Jobs", "POST without auth returns 401/403", lambda:
    fetch("/api/v1/jobs", "POST", {"title": "test"})[0] in [401, 403])

# ═══════════════════════════════════════════════════════════
# 6. BUSINESS API
# ═══════════════════════════════════════════════════════════
print("\n🏢 BUSINESS API")
code, body, _ = fetch("/api/v1/business")
test("Business", "GET /api/v1/business returns 200", lambda: code == 200)
test("Business", "POST without auth returns 401/403", lambda:
    fetch("/api/v1/business", "POST", {"name": "test"})[0] in [401, 403])

# ═══════════════════════════════════════════════════════════
# 7. DIRECTORY API
# ═══════════════════════════════════════════════════════════
print("\n📋 DIRECTORY API")
code, body, _ = fetch("/api/v1/directory")
test("Directory", "GET /api/v1/directory returns 200", lambda: code == 200)
test("Directory", "POST without auth returns 401/403", lambda:
    fetch("/api/v1/directory", "POST", {"name": "test"})[0] in [401, 403])

# ═══════════════════════════════════════════════════════════
# 8. MATRIMONY API
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
# 9. PROFILES API
# ═══════════════════════════════════════════════════════════
print("\n👤 PROFILES API")
code, body, _ = fetch("/api/v1/profiles")
test("Profiles", "GET /api/v1/profiles returns 200", lambda: code == 200)
test("Profiles", "me without auth returns 401", lambda:
    fetch("/api/v1/profiles?me=true")[0] == 401)
test("Profiles", "PUT without auth returns 401", lambda:
    fetch("/api/v1/profiles", "PUT", {"firstName": "test"})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 10. NOTIFICATIONS API
# ═══════════════════════════════════════════════════════════
print("\n🔔 NOTIFICATIONS API")
test("Notifications", "GET without auth returns 401", lambda:
    fetch("/api/v1/notifications")[0] == 401)
test("Notifications", "PATCH without auth returns 401", lambda:
    fetch("/api/v1/notifications", "PATCH", {"markAll": True})[0] == 401)

# ═══════════════════════════════════════════════════════════
# 11. MEMBERSHIP API
# ═══════════════════════════════════════════════════════════
print("\n⭐ MEMBERSHIP API")
code, body, _ = fetch("/api/v1/membership")
test("Membership", "GET /api/v1/membership returns 200", lambda: code == 200)
test("Membership", "Returns plan items", lambda:
    isinstance(body.get("data", {}).get("items"), list) and len(body["data"]["items"]) > 0)

# ═══════════════════════════════════════════════════════════
# 12. MEDIA UPLOAD API
# ═══════════════════════════════════════════════════════════
print("\n📸 MEDIA UPLOAD API")
test("Media", "POST without auth returns 401", lambda:
    fetch("/api/v1/media/upload", "POST", {})[0] == 401)
test("Media", "GET without auth returns 401", lambda:
    fetch("/api/v1/media/upload")[0] == 401)

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
test("Security", "Blocked path /debug returns 404", lambda:
    fetch("/debug")[0] in [404, 403])
test("Security", "Blocked path /graphql returns 404", lambda:
    fetch("/graphql")[0] in [404, 403])
test("Security", "Rate limiting headers present", lambda:
    get_header(fetch("/api/v1/health")[2], 'x-ratelimit-limit') is not None)
test("Security", "Rate limit provider header is edge", lambda:
    get_header(fetch("/api/v1/health")[2], 'x-ratelimit-provider') == 'edge')
test("Security", "Request ID header present", lambda:
    get_header(fetch("/api/v1/health")[2], 'x-request-id') is not None)
test("Security", "SQL injection in search param is handled safely", lambda:
    fetch("/api/v1/jobs?search=test%27%20OR%201%3D1--")[0] in [200, 400, 422])
test("Security", "XSS in search param is handled safely", lambda:
    fetch("/api/v1/jobs?search=<script>alert(1)</script>")[0] in [200, 400])
test("Security", "CORS restricted to bandhan domain", lambda:
    get_header(fetch("/api/v1/health")[2], 'access-control-allow-origin') == BASE)
test("Security", "HSTS includes preload", lambda:
    'preload' in (get_header(fetch("/")[2], 'strict-transport-security') or ''))

# ═══════════════════════════════════════════════════════════
# 16. CORS PREFLIGHT
# ═══════════════════════════════════════════════════════════
print("\n🌐 CORS PREFLIGHT")
# Test OPTIONS request (manual fetch since our helper doesn't support OPTIONS well)
import urllib.request as ur
def options_fetch(path, origin=BASE):
    url = f"{BASE}{path}"
    req = ur.Request(url, method="OPTIONS", headers={
        "User-Agent": BROWSER_UA,
        "Origin": origin,
    })
    try:
        with ur.urlopen(req, timeout=10, context=ctx) as resp:
            return resp.status, dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers)
    except Exception as e:
        return 0, {}

code_opt, hdrs_opt = options_fetch("/api/v1/health")
test("CORS", "OPTIONS preflight returns 204", lambda: code_opt == 204)
test("CORS", "Preflight includes Access-Control-Allow-Origin", lambda:
    get_header(hdrs_opt, 'access-control-allow-origin') == BASE)
test("CORS", "Preflight includes Access-Control-Allow-Methods", lambda:
    get_header(hdrs_opt, 'access-control-allow-methods') is not None)
test("CORS", "Invalid origin rejected on mutating request", lambda:
    fetch("/api/v1/jobs", "POST", {"title": "test"}, {"Origin": "https://evil.com"})[0] == 403)

# ═══════════════════════════════════════════════════════════
# 17. HOMEPAGE
# ═══════════════════════════════════════════════════════════
print("\n🏠 HOMEPAGE")
code_h, body_h, hdrs_h = fetch("/")
test("Homepage", "GET / returns 200", lambda: code_h == 200)
test("Homepage", "Response is HTML", lambda:
    (get_header(hdrs_h, 'content-type') or '').startswith('text/html'))

# ═══════════════════════════════════════════════════════════
# 18. API ROOT
# ═══════════════════════════════════════════════════════════
print("\n🔗 API ROOT")
code_r, body_r, _ = fetch("/api")
test("API Root", "GET /api returns 200", lambda: code_r == 200)

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
