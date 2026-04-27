# Interview Notes — 6B Digital Final Stage

**Interviewers:** Thomas Eyles (Technical Director), David Rabbich (Principal Engineer)
**Format:** 45 minutes — discuss solution, technical decisions, CV/experience, your questions

---

## 1. What I Built

A healthcare appointment booking system — patients submit requests via a public form, practice staff manage them through a protected admin area.

**Three implementations sharing the same PostgreSQL database:**

| Stack | Branch | Status |
|-------|--------|--------|
| NestJS 11 + Next.js 16 + Tailwind | `improved-ux` (main) | Complete — primary deliverable |
| Java Spring Boot 3.4 backend | `claude/lucid-dijkstra` (PR #12) | API complete, shares Next.js frontend |
| C#/.NET 10 + Blazor WASM + SignalR | `claude/festive-elbakyan` (PR #16) | Full stack — independent frontend |

All three backends maintain the same API contract and encryption byte layout — they can be swapped interchangeably.

**Additional PRs:**
- FHIR R4 format (PR #8) — standardised healthcare data endpoints
- Security audit with 36 E2E security tests
- Accessibility testing (WCAG 2.2 Level A/AA via axe-core)

---

## 2. Build Approach & Prioritisation

"With take-home tests, different assessors prioritise different things — architecture, testing, edge cases. So my approach was to cover the full stack properly: security, testing, accessibility, CI/CD, documentation, and Docker — rather than gold-plating one area and neglecting others."

**Build order was deliberate:**

1. **Docker + Postgres + CI pipeline** — foundations first, everyone works from the same environment
2. **Encryption service with tests** — in a healthcare system, PII protection isn't bolted on at the end. Every service that followed was already handling data correctly
3. **Database schema** — encrypted columns, audit log with encrypted change diffs
4. **Appointment API** — CRUD with encryption baked in, not retrofitted
5. **Auth** — JWT + BCrypt, guards on protected routes
6. **Frontend** — booking form, admin dashboard, edit/detail views
7. **WebSockets** — real-time updates when new appointments arrive
8. **Accessibility** — WCAG 2.2 with Playwright + axe-core
9. **FHIR R4** — healthcare interoperability standard
10. **Alternative stacks** — Spring Boot, then .NET + Blazor

Each phase built on tested foundations. Nothing was retrofitted.

---

## 3. Security — Defence in Depth

*(They will ask about this — it's healthcare)*

| Layer | What | Why |
|-------|------|-----|
| **Encryption at rest** | AES-256-GCM on name, email, phone, description | A database dump/backup reveals nothing. Key is separate from data |
| **httpOnly cookies** | JWT stored in httpOnly cookie, not localStorage | XSS cannot steal the token. Secure flag, SameSite=Strict, 8hr expiry |
| **Rate limiting** | 5 req/min on login endpoint | Prevents brute force attacks |
| **Input validation** | Zod (NestJS) / FluentValidation (.NET) on every endpoint | Rejects malformed data before it reaches business logic |
| **Parameterised queries** | Knex (NestJS) / EF Core (.NET) | SQL injection prevention — no raw SQL anywhere |
| **Audit logging** | Every admin action recorded with encrypted change diffs, IP, user agent | Full traceability, changes are encrypted too |
| **Security headers** | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Helmet (NestJS) / custom middleware (.NET) |
| **Password hashing** | BCrypt with 10 rounds | Not reversible, cost factor is tuneable |
| **Security E2E tests** | 36 tests covering SQL injection, XSS payloads, auth bypass | Validates security at the HTTP level |

Key phrase: *"No single layer is the whole story — defence in depth."*

**Why encrypt at application layer when Postgres has encryption at rest?**
"Postgres encryption at rest protects against disk theft. Application-layer encryption protects against database backup leaks, compromised DB credentials, and gives us field-level control. The encryption key is separate from the database — stored in environment variables (Key Vault in production)."

**Why httpOnly cookies over localStorage?**
"localStorage is accessible to any JavaScript on the page. A single XSS vulnerability means the token is stolen. httpOnly cookies are invisible to JavaScript — the browser manages them. Combined with SameSite=Strict, it also prevents CSRF."

---

## 4. Architecture Decisions & Trade-offs

| Decision | Why | Trade-off |
|----------|-----|-----------|
| Knex over TypeORM | Closer to SQL, explicit migrations, lighter | Less magic, more manual |
| Observer pattern for audit logging | Decoupled — services don't know about audit. Adding new listeners doesn't touch existing code | Slightly harder to trace the call chain |
| EF Core over Dapper (.NET) | Idiomatic .NET, model-first, built-in migrations | Less control over exact SQL |
| Blazor WASM over Blazor Server | SPA experience, runs in browser like Next.js, no persistent server connection per user | Larger initial download (~2MB WASM runtime) |
| SignalR over polling | Real-time push, lower overhead, built into .NET | Requires persistent WebSocket connection |
| httpOnly cookies over localStorage JWT | Immune to XSS token theft | Requires CORS credentials config, slightly more complex |
| Encryption at application layer | Portable across backends, survives DB backup leaks | Key management complexity, slight performance cost |
| Tailwind CDN (.NET) vs build step | Zero Node dependency, lean Dockerfile | No tree-shaking — production would use Tailwind CLI |

---

## 5. Testing Strategy

"Test-first, AAA pattern, no mocking the database. If it passes in tests, it works in production."

**NestJS backend:**
- 374+ assertions across 11 spec files
- Integration tests run against real PostgreSQL in Docker
- Validation, encryption roundtrip, auth flow, audit logging, SQL injection, XSS payloads

**Next.js frontend:**
- Vitest + React Testing Library
- Form behaviour, auth context, table rendering

**Accessibility:**
- Playwright + axe-core for WCAG 2.2 Level A/AA
- Keyboard navigation, ARIA attributes, tab order
- 6 E2E accessibility tests

**Security:**
- 36 dedicated E2E security tests
- SQL injection payloads, XSS in every field, auth bypass attempts, rate limiting verification

**.NET backend:**
- 26 tests (xUnit + bUnit + WebApplicationFactory integration)
- Encryption roundtrip, JWT generation/validation, BCrypt auth, full HTTP pipeline, Blazor component rendering

---

## 6. FHIR R4 (PR #8)

FHIR (Fast Healthcare Interoperability Resources) R4 is the standard for exchanging healthcare data between systems — EHRs, scheduling platforms, data warehouses.

**What I built:**
- Two JWT-protected endpoints: `GET /fhir/Appointment` (list as FHIR Bundle) and `GET /fhir/Appointment/:id` (single resource)
- FhirMapper converts internal appointment data to FHIR R4 format
- Status mapping: pending → "proposed", confirmed → "booked", cancelled → "cancelled"
- Patient PII embedded as "contained" resources within each Appointment (no external reference lookups)
- FHIR searchset Bundle with fullUrl links for each entry
- 251 lines of TDD tests for the mapper

**Why it matters:**
"In a real healthcare deployment, appointment data doesn't live in isolation. GP systems, hospital booking platforms, and NHS Spine all speak FHIR. By exposing appointments in FHIR R4 format, the system can integrate with the wider healthcare ecosystem without custom parsing on the consumer side."

---

## 7. Deployment (Thomas will care about this)

**Azure architecture** (documented with Mermaid diagrams in `backend-dotnet/docs/AZURE-DEPLOYMENT.md`):

- **Azure Container Apps** — managed, scales to zero, built-in HTTPS, blue-green deployments via revisions
- **Azure Database for PostgreSQL Flexible Server** — zone-redundant HA (primary in Zone 1, standby in Zone 2, automatic failover)
- **Azure Key Vault** — ENCRYPTION_KEY and JWT_SECRET accessed via managed identity (no stored credentials)
- **Azure Front Door + WAF** — TLS termination, DDoS protection, geographic routing
- **Private Endpoints** — database and Key Vault only accessible via private IPs within the VNet, never internet-facing
- **Availability Zones** — app replicas and database split across Zone 1 and Zone 2

**Blue-green deployment:**
Deploy new revision → health check → swap traffic → old revision stays warm for instant rollback. Zero-downtime releases.

**CI/CD:** GitHub Actions → build → test → push to Azure Container Registry → deploy to staging → health gate → production

---

## 8. What I'd Do With More Time

- EF Core migrations (currently using EnsureCreated — works but doesn't handle schema evolution)
- Tailwind CLI build instead of CDN for tree-shaking
- Structured logging with Serilog (JSON logs for Azure Monitor)
- OpenAPI/Swagger on the .NET API (already on NestJS)
- E2E Playwright tests for the Blazor frontend
- HSTS header (built into ASP.NET Core, one line)
- Proper health checks with `AspNetCore.HealthChecks.NpgSql` (checks actual DB connection)

---

## 9. Assumptions Made

"I considered sending clarification questions, but with Easter I didn't want to block progress."

- Patients can select any date/time (no clinic slot enforcement)
- Single admin user is sufficient (seeded on startup)
- Appointment status flow: pending → confirmed or cancelled (no complex state machine)
- PII encryption key managed via environment variable (Key Vault in production)
- The admin_user_id in audit_log is nullable to preserve audit trail when appointments are deleted

---

## 10. Git Practices

- Feature branches with descriptive names (`feature/phase-1-database-encryption`, `feature/phase-5-admin-full`)
- Detailed commit messages explaining *why* not just *what*
- PRs for nice-to-have features (FHIR, Spring Boot, .NET) — kept separate from the main deliverable
- CI runs on every push: lint, type check, test, npm audit

---

## 11. How the Build Maps to the Job Spec

The job ad asks for specific technologies and responsibilities. Here's where each one is demonstrated:

| Job Requirement | Where It's Demonstrated |
|----------------|------------------------|
| C#, ASP.NET Core (6+) | .NET 10 backend — Controllers, Services, Middleware, DI pipeline |
| SignalR | `AppointmentHub.cs` — real-time notifications, cookie auth on connection |
| Blazor | Full Blazor WASM frontend — pages, components, MVVM, auth state |
| Software architecture & design patterns | MVVM (Blazor), Repository (EF Core), Observer (audit logging), MVC (API) |
| RESTful APIs | Full CRUD matching NestJS API contract, snake_case JSON, proper HTTP status codes |
| Testing frameworks (xUnit, bUnit) | 26 tests — xUnit for services/integration, bUnit for Blazor components, AAA pattern |
| Security & compliance | AES-256-GCM encryption, httpOnly JWT, rate limiting, audit logging, security headers |
| Azure DevOps and services | Deployment architecture documented with Mermaid diagrams — Container Apps, Key Vault, Private Endpoints |
| Solution documentation | ARCHITECTURE.md, PLAN.md, AZURE-DEPLOYMENT.md with ERDs and data flows |
| Code quality tools | ESLint, TypeScript strict mode, FluentValidation, CI pipeline with audit |
| Version control (GitHub) | Feature branches, detailed commits, PRs, GitHub Actions CI |
| Leading complex development | Three interchangeable backends sharing one API contract and database |

**Things to emphasise for Principal-level:**
- The assignment doesn't just show coding — it shows *decision-making*: why encryption first, why this architecture, why these trade-offs
- Three implementations demonstrate the ability to guide a team across different stacks
- Documentation (ARCHITECTURE.md, PLAN.md, deployment diagrams) shows you communicate technical decisions, not just make them
- FHIR R4 shows domain awareness — understanding the healthcare ecosystem, not just building in isolation

---

## 12. Questions to Ask Them

**Engineering culture:**
- How do you approach knowledge sharing across the team? Do you have guilds, communities of practice, or anything similar? I'm keen on setting up cross-discipline learning — for example, giving PHP developers a path into frontend, or backend engineers exposure to cloud architecture. I've seen it work well for retention and building T-shaped engineers
- What does the code review process look like? Is it formal PRs or more collaborative?
- How do you approach technical debt — is there dedicated time, or is it woven into feature work?

**Technical:**
- What does your deployment pipeline look like? Blue-green, rolling, or something else?
- How do you handle PII and data compliance across your healthcare and energy clients?
- Is .NET the primary stack, or do teams work across multiple technologies?

**Team & role:**
- What's the team structure — full-stack or specialist roles? How big are the squads?
- For the Principal role, how much is hands-on coding versus architecture/mentoring?
- What does success look like in the first 6 months?
