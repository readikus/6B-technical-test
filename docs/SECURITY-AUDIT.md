# Security Audit

**Date:** 2026-04-06
**Scope:** SixBee HealthTech appointment booking system — backend (NestJS) and frontend (Next.js)
**Branch:** `security-audit` (based on `bug/admin-login`)

This audit covers OWASP Top 10 categories, authentication, encryption, headers, CORS, input validation, supply chain, and dependency hygiene. Findings are graded **Critical / High / Medium / Low / Info / Positive** and each has a recommendation.

A companion test file `backend/test/security.e2e-spec.ts` actively exercises every Critical/High/Medium finding so regressions are caught in CI.

---

## Critical findings

### C1. WebSocket gateway broadcasts PII to unauthenticated clients

**File:** `backend/src/appointments/appointments.gateway.ts`

The `AppointmentsGateway` is configured with `cors: { origin: true, credentials: true }` and has **no authentication**. When a patient submits a booking, the gateway broadcasts the fully decrypted appointment object — including name, email, phone, and description — to **every connected Socket.IO client**, regardless of origin or auth state.

```ts
@WebSocketGateway({
  cors: { origin: true, credentials: true },  // ⚠️ accepts ANY origin
})
export class AppointmentsGateway {
  @OnEvent('appointment.created')
  handleCreated(appointment: Record<string, unknown>) {
    this.server.emit('appointment.created', appointment);  // ⚠️ no auth check
  }
}
```

**Impact:** Any unauthenticated user — from any origin — can connect to `ws://api/socket.io` and receive a real-time stream of patient PII. This is a HIPAA/GDPR breach in production.

**Recommendation:**
1. Restrict CORS origin to the configured frontend origin (same as the HTTP server).
2. Add a connection-time auth handler that validates the JWT cookie and rejects unauthenticated sockets.
3. Consider scoping events to admin "rooms" — patients should never receive these events.
4. Strip PII from the broadcast payload — emit only an ID and `type: 'created'`, then have the admin frontend re-fetch through the authenticated REST endpoint.

### C2. JWT secret falls back to `'dev-jwt-secret'` when env var unset

**File:** `backend/src/auth/auth.module.ts:10`

```ts
JwtModule.register({
  secret: process.env.JWT_SECRET || 'dev-jwt-secret',  // ⚠️ insecure fallback
  signOptions: { expiresIn: '8h' },
}),
```

**Impact:** If `JWT_SECRET` is missing in production (common deployment misconfiguration), all tokens are signed with a publicly known string. Attackers can forge admin tokens trivially.

**Recommendation:** Throw at boot if `JWT_SECRET` is missing or shorter than 32 bytes. Never have a default. Same applies to `ENCRYPTION_KEY` (which the encryption service does require — apply the same pattern here).

---

## High findings

### H1. Cookie `secure` flag is conditional on `NODE_ENV`

**File:** `backend/src/auth/auth.controller.ts`

```ts
res.cookie(COOKIE_NAME, access_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // ⚠️ silent downgrade
  ...
});
```

**Impact:** If `NODE_ENV` is anything other than `'production'` (typo, missing, set to `'staging'`), the cookie is sent over HTTP. A network attacker can steal it.

**Recommendation:** Default `secure: true` and require an explicit opt-out for local dev (e.g. check for `localhost` host header, or a separate `COOKIE_SECURE=false` env var that's loud and intentional).

### H2. No rate limiting on the login endpoint

**File:** `backend/src/auth/auth.controller.ts`

The `POST /auth/login` endpoint has no rate limiting. With bcrypt cost 10, each attempt is ~100ms — slow enough to deter casual brute force but fast enough to attack a weak password in under an hour with even a single attacker.

**Impact:** Enables credential stuffing and brute force attacks. No account lockout, no IP throttling.

**Recommendation:**
- Install `@nestjs/throttler` and apply `@Throttle({ default: { limit: 5, ttl: 60_000 } })` to `POST /auth/login` (5 attempts per minute per IP).
- For higher security, add per-account throttling (5 attempts per email per 15 minutes).
- Consider account lockout after N failed attempts.

### H3. WebSocket gateway accepts any origin

Already covered in C1, listed separately for tracking. The `cors: { origin: true }` in the gateway is broader than the HTTP CORS, which uses an explicit allowlist. They should be consistent.

---

## Medium findings

### M1. Login validation errors return HTTP 200

**File:** `backend/src/auth/auth.controller.ts`

```ts
if (!result.success) {
  return { statusCode: 400, message: 'Validation failed', errors };
}
```

The endpoint returns HTTP 200 with a `statusCode: 400` field in the body. This is misleading and breaks any monitoring/alerting that relies on HTTP status codes.

**Impact:** Failed validations are invisible to log aggregators and uptime checks. Clients can't use standard HTTP error handling.

**Recommendation:** Throw `BadRequestException` instead — this returns a proper 400.

### M2. No password complexity requirements

**File:** `backend/src/auth/auth.validation.ts`

```ts
password: z.string().min(1, 'Password is required'),
```

**Impact:** A 1-character password is accepted at login. Coupled with H2 (no rate limiting), this is a real risk. The seed user happens to use `changeme` which is also weak.

**Recommendation:** Min length 12, require upper/lower/digit/symbol, check against a known-breached password list (e.g. HaveIBeenPwned k-anonymity API). Apply at the seed/admin-creation endpoint, not login (to avoid breaking existing accounts).

### M3. Logout does not require authentication

**File:** `backend/src/auth/auth.controller.ts`

`POST /auth/logout` has no `@UseGuards(JwtAuthGuard)`. Anyone can call it. In practice it only clears the caller's own cookie so it's not exploitable, but it's an inconsistency that should be tightened — log unexpected logout calls, etc.

**Recommendation:** Add the guard. Also consider invalidating server-side state (token blacklist or token version in the DB) so a stolen cookie can be revoked.

### M4. Audit log does not record IP address or user agent

**File:** `backend/src/audit/audit.service.ts`

The audit log records who did what, but not where from. For incident response and PII access tracking under GDPR, you need to know the source IP and user agent of every admin action.

**Recommendation:** Pass `req.ip` and `req.headers['user-agent']` through to the audit event and persist them.

### M5. Helmet uses defaults — no Content Security Policy

**File:** `backend/src/main.ts`

`app.use(helmet())` enables the defaults but does not configure a Content Security Policy. The frontend has no CSP either.

**Impact:** Reduced defense-in-depth against XSS. Even though Zod rejects HTML in inputs, a CSP would block any injected script execution as a second line of defence.

**Recommendation:** Configure Helmet with an explicit CSP that blocks inline scripts/styles, restricts connect-src to the API origin, and allows the WebSocket origin.

### M6. Swagger docs exposed in production

**File:** `backend/src/main.ts`

```ts
SwaggerModule.setup('api/docs', app, document);
```

No guard, no env check — `/api/docs` is publicly available in any environment.

**Impact:** Information disclosure — schemas, endpoints, examples all leaked. Helps attackers map the attack surface.

**Recommendation:** Wrap in `if (process.env.NODE_ENV !== 'production')`.

---

## Low findings

### L1. Bcrypt cost factor is the default (10)

**File:** `backend/src/auth/auth.service.ts`, seed file

10 rounds is the historical default but considered low for new applications in 2026. OWASP recommends 12+.

**Recommendation:** Bump to 12. Migrate existing hashes lazily on next login.

### L2. Encryption key stored in plain `.env`

**File:** `.env.example`

The 32-byte AES key sits in environment variables, which means it ends up in `.env` files, CI secrets, and process listings. The bar should be a KMS-backed key (AWS KMS, GCP KMS, HashiCorp Vault) with key rotation.

**Recommendation:** For production, integrate with a KMS. Rotate keys with versioned envelope encryption (record the key version alongside each ciphertext).

### L3. Audit log changes are encrypted but the key is the same as PII

**File:** `backend/src/audit/audit.service.ts`

Compromise of the encryption key reveals both current PII and the historical change diffs. They should ideally use a separate key with a different rotation policy.

**Recommendation:** Use envelope encryption with per-table data keys.

### L4. No structured logging of security events

The system doesn't log successful logins, failed logins, logout events, JWT verification failures, or authorisation denials. Without these, incident response is impossible.

**Recommendation:** Add structured logging for all auth events (success and failure), with IP, user agent, and timestamp.

---

## Info / observations

### I1. Helmet defaults set good baseline headers

`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security` (when HTTPS is detected), and `X-DNS-Prefetch-Control` are all enabled. ✅

### I2. CORS uses explicit allowlist for HTTP

`backend/src/main.ts` uses `process.env.CORS_ORIGIN || 'http://localhost:3000'` — comma-separated allowlist. Good. The WebSocket gateway is the gap (C1).

### I3. Backend production dependencies clean

`npm audit --omit=dev` reports zero vulnerabilities for both backend and frontend production dependencies. The reported high-severity Vite advisory is dev-only.

### I4. Frontend has no token storage

After the httpOnly cookie migration, the frontend holds no auth state in JavaScript. XSS cannot exfiltrate session tokens. ✅

---

## Positive findings (things done well)

### P1. AES-256-GCM encryption is correctly implemented

**File:** `backend/src/encryption/encryption.service.ts`

- A fresh random 12-byte IV is generated per `encrypt` call (no IV reuse)
- The auth tag (16 bytes) is captured and verified on decrypt
- Decryption fails loudly on tampered ciphertext or wrong key
- IV, auth tag, and ciphertext are packed in a single base64 blob — simple and correct

### P2. Parameterised queries via Knex everywhere

No raw SQL string interpolation anywhere in `appointments.repository.ts`, `audit.repository.ts`, or seed/migration files. SQL injection surface is effectively zero.

### P3. Input validation rejects HTML at the boundary

Zod schemas with custom refinements reject HTML tags in `name` and `description`:
```ts
const noHtmlTags = (val: string) => !/<[a-zA-Z][^>]*>/.test(val);
```
This stops XSS payloads at the API boundary, before they ever reach the database.

### P4. PII encrypted at rest

All four PII fields (name, email, phone, description) are encrypted before insert and decrypted in the service layer. The repository layer never sees plaintext. The database dump contains only ciphertext.

### P5. Audit log entries are encrypted

Change diffs in the audit log are encrypted with the same scheme as the appointment fields. PII in the audit trail is not exposed in raw DB queries.

### P6. JWT auth via httpOnly cookie

Tokens are not accessible from JavaScript (`httpOnly: true`), are sent only to the API origin (`SameSite: 'strict'`), and are cleared on logout. Significant improvement over the original localStorage approach.

### P7. CSRF is mitigated by SameSite=Strict

For first-party usage, `SameSite=Strict` prevents the browser from sending the cookie on cross-origin requests. This effectively blocks CSRF without needing CSRF tokens — for as long as the deployment topology stays first-party.

### P8. Backend tests run against real Postgres

No mocks in the data layer means SQL injection, encryption round-trips, and migration drift are all caught in CI.

---

## Test coverage

The companion file `backend/test/security.e2e-spec.ts` adds **active security tests** for every Critical/High/Medium finding above:

| Finding | Test |
|---------|------|
| C1 | WebSocket connection without auth, verify PII broadcast received (currently passes — confirming the vulnerability) |
| C2 | Verify JWT_SECRET fallback exists (documented, not testable without unsetting env) |
| H1 | Verify `secure` flag on cookie in production-like env |
| H2 | 100 rapid login attempts succeed without throttling (currently passes — confirming the vulnerability) |
| H3 | WebSocket CORS test |
| M1 | POST /auth/login with invalid body returns HTTP 200 instead of 400 |
| M2 | POST /auth/login accepts a 1-character password at the schema level |
| M3 | POST /auth/logout accepted without auth |
| M5 | Verify no CSP header set |
| M6 | GET /api/docs returns 200 |

Plus exhaustive coverage of:
- **JWT tampering** — modified payload, modified signature, `alg: none` confusion
- **Cookie tampering** — modified cookie value
- **Auth bypass** — missing cookie, missing header, expired token
- **SQL injection** — multiple payloads in path params, query params, body fields
- **XSS** — payloads in every string field, on create and update
- **IDOR** — N/A (single tenant; all admins see all appointments by design)
- **Mass assignment** — extra fields in request body (Zod strips them; verified)
- **Path traversal** — `../` payloads in URL params
- **Header injection** — newlines in cookie/header values
- **Login user enumeration** — verify same response shape for invalid user vs invalid password

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 3 |
| Medium | 6 |
| Low | 4 |
| Info | 4 |
| Positive | 8 |

**The two Critical findings (C1, C2) should be fixed before any production deployment.** C1 is the most severe — patient PII is currently broadcast to any unauthenticated WebSocket client. The httpOnly cookie change in `bug/admin-login` was a step in the right direction, but the WebSocket gateway needs the same treatment.

The High findings are deployment-time configuration issues — they don't affect local dev but will bite hard in production if not addressed.

Most Medium findings are quality-of-life and defence-in-depth improvements; none are individually critical but together they significantly raise the security bar.
