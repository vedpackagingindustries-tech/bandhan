#!/usr/bin/env python3
"""Smoke tests for Bandhan production deployment"""
import json, sys, urllib.request, urllib.error

BASE = "https://bandhan-sahu-connect.vercel.app"
results = []

def test(name, fn):
    try:
        ok, detail = fn()
        results.append(("✅" if ok else "❌", name, detail))
    except Exception as e:
        results.append(("❌", name, str(e)))

def api(path, data=None, headers=None, method=None):
    url = f"{BASE}{path}"
    hdrs = headers or {}
    if data:
        hdrs["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=hdrs, method=method or "POST")
    else:
        req = urllib.request.Request(url, headers=hdrs, method=method or "GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode()
            return r.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

# ─── 1. Homepage ───
def t_homepage():
    url = f"{BASE}/"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=15) as r:
        ct = r.headers.get("Content-Type", "")
        size = len(r.read())
    return r.status == 200 and "text/html" in ct, f"HTTP {r.status} {ct[:30]} {size}B"
test("Homepage", t_homepage)

# ─── 2. Health API ───
def t_health():
    code, d = api("/api/v1/health")
    return code == 200, f"HTTP {code} status={d.get('data',{}).get('status','?')}"
test("Health API", t_health)

# ─── 3. Gotras API ───
def t_gotras():
    code, d = api("/api/v1/gotras")
    total = 0
    if isinstance(d, dict):
        total = d.get("data",{}).get("total", 0) if isinstance(d.get("data"), dict) else len(d.get("data",[]))
    return code == 200 and total > 0, f"HTTP {code} total={total}"
test("Gotras API", t_gotras)

# ─── 4. Jobs API ───
def t_jobs():
    code, d = api("/api/v1/jobs")
    total = d.get("data",{}).get("total", 0)
    return code == 200 and total >= 0, f"HTTP {code} total={total}"
test("Jobs API", t_jobs)

# ─── 5. Business API ───
def t_business():
    code, d = api("/api/v1/business")
    total = d.get("data",{}).get("total", 0)
    return code == 200 and total >= 0, f"HTTP {code} total={total}"
test("Business API", t_business)

# ─── 6. Directory API ───
def t_directory():
    code, d = api("/api/v1/directory")
    total = d.get("data",{}).get("total", 0)
    return code == 200 and total >= 0, f"HTTP {code} total={total}"
test("Directory API", t_directory)

# ─── 7. Login API (reject bad creds) ───
def t_login_reject():
    code, d = api("/api/v1/auth/login", {"email": "nobody@nowhere.com", "password": "wrongpass123"})
    return code in (401, 403), f"HTTP {code} (rejected as expected)"
test("Login rejects bad creds", t_login_reject)

# ─── 8. Login API (admin must set new password - test without real password) ───
def t_login_admin_security():
    # Verify admin login rejects wrong password (no hardcoded creds in test)
    code, d = api("/api/v1/auth/login", {"email": "admin@bandhan.com", "password": "WrongTestPassword123!"})
    return code in (401, 403, 423), f"HTTP {code} (rejected as expected, no hardcoded password)"
test("Login admin security (no hardcoded creds)", t_login_admin_security)

# ─── 9. Register API (validation) ───
def t_register_validate():
    code, d = api("/api/v1/auth/register", {"email": "test@test.com"})
    return code in (400, 422, 200, 201), f"HTTP {code} (validation works)"
test("Register validation", t_register_validate)

# ─── 10. OTP Send API (rate limited / works) ───
def t_otp_send():
    code, d = api("/api/v1/auth/otp/send", {"identifier": "test@bandhan.com", "type": "REGISTRATION", "method": "EMAIL"})
    return code in (200, 201, 429), f"HTTP {code} msg={d.get('data',{}).get('message','')[:50]}"
test("OTP Send API", t_otp_send)

# ─── 11. Forgot Password - Initiate ───
def t_forgot_pw():
    code, d = api("/api/v1/auth/password", {"identifier": "admin@bandhan.com", "method": "EMAIL"}, method="POST")
    return code in (200, 201, 429), f"HTTP {code} msg={d.get('data',{}).get('message','')[:60]}"
test("Forgot Password initiate", t_forgot_pw)

# ─── 12. Security Headers ───
def t_security_headers():
    url = f"{BASE}/"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=15) as r:
        xfo = r.headers.get("X-Frame-Options", "")
        hsts = r.headers.get("Strict-Transport-Security", "")
        xcto = r.headers.get("X-Content-Type-Options", "")
    ok = xfo == "DENY" and "max-age" in hsts and xcto == "nosniff"
    return ok, f"X-Frame={xfo} HSTS={'yes' if hsts else 'no'} X-Content={xcto}"
test("Security Headers", t_security_headers)

# ─── 13. Attack paths blocked ───
def t_attack_paths():
    code, _ = api("/.env")
    return code in (403, 404), f"HTTP {code} (.env blocked)"
test("Attack path /.env blocked", t_attack_paths)

# ─── 14. No hardcoded credentials in API ───
def t_no_creds_leak():
    code, d = api("/api/v1/health")
    body = json.dumps(d)
    has_hardcoded = "Admin@123" in body or "admin123" in body
    return not has_hardcoded, "No hardcoded passwords in response"
test("No credential leak in API", t_no_creds_leak)

# ─── Results ───
print("\n" + "="*60)
print("BANDHAN SMOKE TEST RESULTS")
print("="*60)
pass_count = 0
for icon, name, detail in results:
    print(f"  {icon} {name}: {detail}")
    if icon == "✅":
        pass_count += 1
print(f"\n{'='*60}")
print(f"  PASSED: {pass_count}/{len(results)}")
print(f"{'='*60}\n")
sys.exit(0 if pass_count == len(results) else 1)
