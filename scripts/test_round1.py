import urllib.request, json, re, sys

print('=== ROUND 1: पूर्ण एपीआई और फंक्शन टेस्ट ===')
print()

base = 'http://localhost:3000'
tests = [
    ('होमपेज', '/'),
    ('हेल्थ API', '/api/v1/health'),
    ('पब्लिक कॉन्फिग', '/api/v1/config/public'),
    ('गोत्र API', '/api/v1/gotras'),
    ('पब्लिक स्टैट्स', '/api/v1/stats/public'),
    ('सर्च API', '/api/v1/search?q=test'),
    ('लोकेशन API', '/api/v1/locations'),
    ('मेंबरशिप प्लान', '/api/v1/membership/plans'),
    ('बिज़नेस डायरेक्टरी', '/api/v1/business'),
    ('जॉब्स API', '/api/v1/jobs'),
    ('मैट्रिमोनी सर्च', '/api/v1/matrimony/search?limit=1'),
    ('ऑर्गनाइज़ेशन डायरेक्टरी', '/api/v1/directory'),
]

passed = 0
failed = 0
details = []
for name, path in tests:
    try:
        req = urllib.request.Request(base + path)
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.status
        body = resp.read().decode('utf-8', errors='replace')[:500]
        if code == 200:
            passed += 1
            status = 'PASS'
        else:
            failed += 1
            status = f'FAIL HTTP {code}'
        detail = f'  [{status}] {name}'
        if 'gotras' in path and code == 200:
            try:
                d = json.loads(body)
                total = d.get('data', {}).get('total', 'N/A')
                detail += f' (गोत्र: {total})'
            except:
                pass
        details.append(detail)
    except Exception as e:
        failed += 1
        details.append(f'  [ERROR] {name}: {str(e)[:80]}')

for d in details:
    print(d)

print(f'\n  API परिणाम: {passed}/{len(tests)} पास, {failed} फेल')
print()

# Static resources
print('  स्टैटिक रिसोर्सेज टेस्ट...')
try:
    req = urllib.request.Request(base + '/')
    resp = urllib.request.urlopen(req, timeout=10)
    html = resp.read().decode('utf-8', errors='replace')
    resources = re.findall(r'(?:src|href)="(/_next/[^"\s]+)"', html)
    res_pass = 0
    res_fail = 0
    for r in resources[:20]:
        try:
            r2 = urllib.request.Request(base + r)
            c = urllib.request.urlopen(r2, timeout=5).status
            if c == 200:
                res_pass += 1
            else:
                res_fail += 1
        except:
            res_fail += 1
    print(f'  रिसोर्स: {res_pass}/{res_pass + res_fail} सफलतापूर्वक लोड')
except Exception as e:
    print(f'  रिसोर्स एरर: {e}')

print()
print('=== ROUND 1 पूर्ण ===')
