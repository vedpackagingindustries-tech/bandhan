import urllib.request, json, re, time

print('=== ROUND 2: दोबारा पूर्ण टेस्ट (बग-फ्री सत्यापन) ===')
print()

base = 'http://localhost:3000'

# === PHASE 1: पब्लिक APIs ===
print('--- फ़ेज़ 1: पब्लिक APIs ---')
public_tests = [
    ('होमपेज HTML', '/'),
    ('हेल्थ चेक', '/api/v1/health'),
    ('पब्लिक कॉन्फिग', '/api/v1/config/public'),
    ('गोत्र (93)', '/api/v1/gotras'),
    ('पब्लिक स्टैट्स', '/api/v1/stats/public'),
    ('सुझाव (suggest)', '/api/v1/search?suggest=sha'),
    ('लोकेशन', '/api/v1/locations'),
    ('मेंबरशिप प्लान', '/api/v1/membership/plans'),
    ('बिज़नेस लिस्ट', '/api/v1/business'),
    ('जॉब्स लिस्ट', '/api/v1/jobs'),
    ('डायरेक्टरी', '/api/v1/directory'),
]

pub_pass = 0
pub_fail = 0
for name, path in public_tests:
    try:
        req = urllib.request.Request(base + path)
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.status
        body = resp.read().decode('utf-8', errors='replace')[:500]
        if code == 200:
            pub_pass += 1
            extra = ''
            if 'gotras' in path:
                try:
                    d = json.loads(body)
                    total = d.get('data', {}).get('total', 'N/A')
                    extra = f' (कुल: {total})'
                except: pass
            if 'suggest' in path:
                try:
                    d = json.loads(body)
                    suggestions = d.get('data', {}).get('suggestions', [])
                    extra = f' (सुझाव: {len(suggestions)})'
                except: pass
            print(f'  PASS | {name}{extra}')
        else:
            pub_fail += 1
            print(f'  FAIL | {name} (HTTP {code})')
    except Exception as e:
        pub_fail += 1
        print(f'  ERROR | {name}: {str(e)[:60]}')

print(f'  फ़ेज़ 1 परिणाम: {pub_pass}/{len(public_tests)} पास')
print()

# === PHASE 2: प्रोटेक्टेड APIs (401 expected) ===
print('--- फ़ेज़ 2: प्रोटेक्टेड APIs (401 जरूरी) ---')
protected_tests = [
    ('प्रोफ़ाइल सर्च', '/api/v1/search?q=test'),
    ('मैट्रिमोनी सर्च', '/api/v1/matrimony/search?limit=1'),
    ('यूज़र प्रोफ़ाइल', '/api/v1/user/profile'),
    ('कॉन्टैक्ट्स', '/api/v1/contacts'),
    ('नोटिफिकेशन', '/api/v1/user/notifications'),
    ('पेमेंट्स', '/api/v1/payments'),
]

prot_pass = 0
prot_fail = 0
for name, path in protected_tests:
    try:
        req = urllib.request.Request(base + path)
        resp = urllib.request.urlopen(req, timeout=5)
        code = resp.status
        if code == 401:
            prot_pass += 1
            print(f'  PASS | {name} (सही से 401 लौटाया)')
        else:
            prot_fail += 1
            print(f'  FAIL | {name} (HTTP {code}, 401 चाहिए था)')
    except urllib.error.HTTPError as e:
        if e.code == 401:
            prot_pass += 1
            print(f'  PASS | {name} (सही से 401 लौटाया)')
        else:
            prot_fail += 1
            print(f'  FAIL | {name} (HTTP {e.code}, 401 चाहिए था)')
    except Exception as e:
        prot_fail += 1
        print(f'  ERROR | {name}: {str(e)[:60]}')

print(f'  फ़ेज़ 2 परिणाम: {prot_pass}/{len(protected_tests)} पास')
print()

# === PHASE 3: स्टैटिक रिसोर्सेज ===
print('--- फ़ेज़ 3: स्टैटिक रिसोर्सेज ---')
try:
    req = urllib.request.Request(base + '/')
    resp = urllib.request.urlopen(req, timeout=10)
    html = resp.read().decode('utf-8', errors='replace')
    resources = re.findall(r'(?:src|href)="(/_next/[^"\s]+)"', html)
    css_ok = 0
    js_ok = 0
    img_ok = 0
    res_fail = 0
    for r in resources:
        try:
            r2 = urllib.request.Request(base + r)
            c = urllib.request.urlopen(r2, timeout=5).status
            if c == 200:
                if r.endswith('.css') or 'css' in r:
                    css_ok += 1
                elif r.endswith('.js') or 'js' in r:
                    js_ok += 1
                else:
                    img_ok += 1
            else:
                res_fail += 1
        except:
            res_fail += 1
    total_res = css_ok + js_ok + img_ok + res_fail
    print(f'  CSS: {css_ok} | JS: {js_ok} | अन्य: {img_ok} | फेल: {res_fail}')
    print(f'  कुल: {css_ok + js_ok + img_ok}/{total_res} लोड सफल')
except Exception as e:
    print(f'  एरर: {e}')

print()

# === PHASE 4: HTML संरचना ===
print('--- फ़ेज़ 4: HTML संरचना वेरिफिकेशन ---')
try:
    req = urllib.request.Request(base + '/')
    resp = urllib.request.urlopen(req, timeout=10)
    html = resp.read().decode('utf-8', errors='replace')
    checks = [
        ('DOCTYPE', '<!DOCTYPE html>' in html or '<!doctype html>' in html),
        ('<html> टैग', '<html' in html),
        ('<body> टैग', '<body' in html),
        ('meta viewport', 'viewport' in html),
        ('title टैग', '<title>' in html),
        ('Bandhan title', 'Bandhan' in html),
        ('_next CSS लिंक', '/_next' in html and '.css' in html),
        ('_next JS लिंक', '/_next' in html and '.js' in html),
        ('SEO meta desc', 'description' in html),
        ('OG tags', 'og:title' in html),
    ]
    html_pass = sum(1 for _, v in checks)
    for name, ok in checks:
        print(f'  {"PASS" if ok else "FAIL"} | {name}')
    print(f'  HTML वेरिफिकेशन: {html_pass}/{len(checks)} पास')
except Exception as e:
    print(f'  एरर: {e}')

print()

# === PHASE 5: गोत्र डेटा इंटीग्रिटी ===
print('--- फ़ेज़ 5: गोत्र डेटा इंटीग्रिटी (93 जरूरी) ---')
try:
    req = urllib.request.Request(base + '/api/v1/gotras')
    resp = urllib.request.urlopen(req, timeout=10)
    body = resp.read().decode('utf-8', errors='replace')
    d = json.loads(body)
    total = d.get('data', {}).get('total', 0)
    gotras = d.get('data', {}).get('gotras', [])
    names = [g.get('name', '') for g in gotras]
    dupes = len(names) - len(set(names))
    empty_names = sum(1 for n in names if not n.strip())
    has_ids = all(g.get('id') for g in gotras)
    print(f'  कुल गोत्र: {total}')
    print(f'  डुप्लिकेट: {dupes}')
    print(f'  खाली नाम: {empty_names}')
    print(f'  सभी ID मौजूद: {"हाँ" if has_ids else "नहीं"}')
    if total == 93 and dupes == 0 and empty_names == 0 and has_ids:
        print(f'  PASS | गोत्र डेटा 100% सही')
    else:
        print(f'  FAIL | गोत्र डेटा में समस्या')
except Exception as e:
    print(f'  ERROR: {e}')

print()
print('=== ROUND 2 पूर्ण ===')
