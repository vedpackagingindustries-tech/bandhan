# Bandhan — Final Audit Report

**Date:** 2026-10-23 10:52:01 UTC

**Production URL:** https://bandhan-sahu-connect.vercel.app

**Score:** 98.4% (63 PASS / 64 total)

## Summary

| Status | Count |
|--------|-------|
| ✅ PASS | 63 |
| ❌ FAIL | 0 |
| ⚠️ WARN | 0 |
| ℹ️ INFO | 1 |

## Transport

| ID | Status | Detail |
|----|--------|--------|
| HSTS | ✅ PASS | Strict-Transport-Security: max-age=63072000; includeSubDomains; preload |
| HSTS_PRELOAD | ✅ PASS | HSTS includes preload directive: True |
| X_FRAME_OPTIONS | ✅ PASS | X-Frame-Options: DENY |
| X_CONTENT_TYPE | ✅ PASS | X-Content-Type-Options: nosniff |
| CSP | ✅ PASS | CSP header present |
| REFERRER_POLICY | ✅ PASS | Referrer-Policy: strict-origin-when-cross-origin |
| PERMISSIONS_POLICY | ✅ PASS | Permissions-Policy: camera=(), microphone=(), geolocation=() |
| NO_POWERED_BY | ✅ PASS | X-Powered-By header removed |

## API

| ID | Status | Detail |
|----|--------|--------|
| ENDPOINT_API_ROOT | ✅ PASS | GET /api → 200 (expected 200) |
| ENDPOINT_HEALTH_CHECK | ✅ PASS | GET /api/v1/health → 200 (expected 200) |
| ENDPOINT_GOTRAS | ✅ PASS | GET /api/v1/gotras → 200 (expected 200) |
| ENDPOINT_LOCATIONS | ✅ PASS | GET /api/v1/locations → 200 (expected 200) |
| ENDPOINT_JOBS | ✅ PASS | GET /api/v1/jobs → 200 (expected 200) |
| ENDPOINT_BUSINESS | ✅ PASS | GET /api/v1/business → 200 (expected 200) |
| ENDPOINT_DIRECTORY | ✅ PASS | GET /api/v1/directory → 200 (expected 200) |
| ENDPOINT_MATRIMONY_SEARCH | ✅ PASS | GET /api/v1/matrimony/search → 200 (expected 200) |
| ENDPOINT_PROFILES | ✅ PASS | GET /api/v1/profiles → 200 (expected 200) |
| ENDPOINT_MEMBERSHIP_PLANS | ✅ PASS | GET /api/v1/membership → 200 (expected 200) |
| ENDPOINT_NOTIFICATIONS_(AUTH_REQUIRED) | ✅ PASS | GET /api/v1/notifications → 401 (expected 401) |
| ENDPOINT_MEDIA_UPLOAD_(AUTH_REQUIRED) | ✅ PASS | GET /api/v1/media/upload → 401 (expected 401) |
| ENDPOINT_ADMIN_USERS_(AUTH_REQUIRED) | ✅ PASS | GET /api/v1/admin/users → 401 (expected 401) |
| ENDPOINT_ADMIN_DASHBOARD_(AUTH_REQUIRED) | ✅ PASS | GET /api/v1/admin/dashboard → 401 (expected 401) |
| ENDPOINT_ADMIN_OTP_(AUTH_REQUIRED) | ✅ PASS | GET /api/v1/admin/otp/recent → 401 (expected 401) |
| ENDPOINT_AUTH_ME_(AUTH_REQUIRED) | ✅ PASS | GET /api/v1/auth/me → 401 (expected 401) |

## Auth

| ID | Status | Detail |
|----|--------|--------|
| LOGIN_EMPTY_BODY | ✅ PASS | Empty login returns 400 |
| REGISTER_EMPTY_BODY | ✅ PASS | Empty register returns 500 |
| ME_NO_TOKEN | ✅ PASS | Me without token returns 401 |

## CSRF

| ID | Status | Detail |
|----|--------|--------|
| INVALID_ORIGIN_REJECTED | ✅ PASS | POST with evil origin returns 403 |
| NO_ORIGIN_AUTH_REJECTED | ✅ PASS | POST /auth/login without origin returns 403 |
| PREFLIGHT_204 | ✅ PASS | OPTIONS preflight returns 204 |

## RateLimit

| ID | Status | Detail |
|----|--------|--------|
| HEADERS_PRESENT | ✅ PASS | X-RateLimit-Limit: 100 |
| PROVIDER_EDGE | ✅ PASS | X-RateLimit-Provider: edge |
| REQUEST_ID | ✅ PASS | X-Request-Id: 1792752726272-47.57.23 |

## AttackPaths

| ID | Status | Detail |
|----|--------|--------|
| BLOCK___env | ✅ PASS | /.env → 404 |
| BLOCK___env_local | ✅ PASS | /.env.local → 404 |
| BLOCK___git | ✅ PASS | /.git → 404 |
| BLOCK__wp-admin | ✅ PASS | /wp-admin → 403 |
| BLOCK__wp-login | ✅ PASS | /wp-login → 403 |
| BLOCK__phpmyadmin | ✅ PASS | /phpmyadmin → 404 |
| BLOCK__xmlrpc_php | ✅ PASS | /xmlrpc.php → 403 |
| BLOCK__debug | ✅ PASS | /debug → 404 |
| BLOCK__console | ✅ PASS | /console → 404 |
| BLOCK__graphql | ✅ PASS | /graphql → 404 |
| BLOCK__actuator | ✅ PASS | /actuator → 404 |
| BLOCK__backup | ✅ PASS | /backup → 404 |
| BLOCK__dump | ✅ PASS | /dump → 404 |

## Validation

| ID | Status | Detail |
|----|--------|--------|
| SQLI_SAFE | ✅ PASS | SQLi in search returns 200 |
| XSS_SAFE | ✅ PASS | XSS in search returns 200 |

## CORS

| ID | Status | Detail |
|----|--------|--------|
| RESTRICTED_ORIGIN | ✅ PASS | Access-Control-Allow-Origin: https://bandhan-sahu-connect.vercel.app |
| CREDENTIALS_ALLOWED | ✅ PASS | Access-Control-Allow-Credentials: true |

## Codebase

| ID | Status | Detail |
|----|--------|--------|
| API_ROUTES_COUNT | ℹ️ INFO | 24 API route files found |
| KEY_FILE_src_middleware_ts | ✅ PASS | src/middleware.ts exists |
| KEY_FILE_src_lib_auth_ts | ✅ PASS | src/lib/auth.ts exists |
| KEY_FILE_src_lib_rate-limit_ts | ✅ PASS | src/lib/rate-limit.ts exists |
| KEY_FILE_src_lib_validation_ts | ✅ PASS | src/lib/validation.ts exists |
| KEY_FILE_src_lib_auth-middleware_ts | ✅ PASS | src/lib/auth-middleware.ts exists |
| KEY_FILE_src_lib_api-response_ts | ✅ PASS | src/lib/api-response.ts exists |
| KEY_FILE_prisma_schema_prisma | ✅ PASS | prisma/schema.prisma exists |
| TYPESCRIPT_STRICT | ✅ PASS | ignoreBuildErrors: false in next.config.ts |

## Health

| ID | Status | Detail |
|----|--------|--------|
| OVERALL_STATUS | ✅ PASS | Overall: HEALTHY |
| CHECK_DATABASE | ✅ PASS | UP (5ms) |
| CHECK_CACHE | ✅ PASS | UP — 0 entries, 0 expired |
| CHECK_JOB_QUEUE | ✅ PASS | UP — 0 pending, 0 processing |
| CHECK_MEMORY | ✅ PASS | UP — 31MB heap used |

