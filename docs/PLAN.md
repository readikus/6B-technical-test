# Build Plan

## Engineering Approach

Every feature is built **test-first** using the **AAA (Arrange-Act-Assert)** TDD pattern:

1. Write the failing test
2. Write the minimum code to pass
3. Refactor while tests stay green

Integration tests run against real PostgreSQL in Docker — no mocking the database.

---

## Milestones

### Phase 0: Project Scaffolding + CI Pipeline
- [x] Git init, `.gitignore`
- [x] Scaffold NestJS backend with Vitest
- [x] Scaffold Next.js frontend with Vitest + Tailwind
- [x] Docker Compose (PostgreSQL, backend, frontend)
- [x] GitHub Actions CI (lint, test, audit)
- [x] Architecture documentation

### Phase 1: Database Schema + Encryption
- [x] Knex config + 3 migrations (`admin_users`, `appointments`, `audit_log`)
- [x] AES-256-GCM encryption service (TDD)
- [x] Admin user seed (BCrypt hashed)
- [x] Docker entrypoint runs migrations + seed on startup

### Phase 2: Appointment API with Full Test Coverage
- [ ] Knex database module for NestJS
- [ ] Appointment CRUD endpoints (POST, GET, PATCH, DELETE)
- [ ] Zod input validation (email, phone, required fields)
- [ ] Encryption/decryption of PII fields through the API layer
- [ ] Helmet middleware + CORS configuration
- [ ] Integration tests: validation, SQL injection, XSS payloads

### Phase 3: Patient-Facing Booking Form
- [ ] Appointment request form (name, date/time, description, phone, email)
- [ ] Client-side validation matching API Zod schemas
- [ ] Form submission to API + success/error feedback
- [ ] Responsive Tailwind styling
- [ ] Frontend tests for form behaviour

### Phase 4: Admin Login + Appointment List View
- [ ] JWT auth module (login endpoint, 8hr expiry)
- [ ] Auth guard for protected routes
- [ ] Admin login page
- [ ] Appointment table ordered by date
- [ ] Approved rows highlighted with colour change
- [ ] Navigation bar with logout
- [ ] Frontend tests for auth flow and table rendering

### Phase 5: Admin Full Functionality
- [ ] Approve appointment (status toggle + row colour)
- [ ] Edit appointment (pre-populated form, save changes)
- [ ] Delete appointment
- [ ] Audit log entries for all admin actions
- [ ] Integration tests for each action

### Phase 6 (Nice to have): WebSockets in Admin
- [ ] Real-time updates when new appointments are submitted

### Phase 7 (Nice to have): FHIR Format
- [ ] Appointment records available in FHIR R4 format

### Phase 8 (Nice to have): Spring Boot API
- [ ] Port API to Spring Boot (Java)

---

## Security Checklist

- [ ] Helmet middleware on NestJS
- [ ] AES-256-GCM encryption at rest for all PII fields
- [ ] BCrypt password hashing (10 rounds)
- [ ] JWT auth with 8hr expiry
- [ ] Zod input validation
- [ ] Parameterised queries via Knex (no raw SQL)
- [ ] CORS configured
- [ ] `npm audit` clean on both projects
- [ ] E2E tests for SQL injection and XSS payloads
