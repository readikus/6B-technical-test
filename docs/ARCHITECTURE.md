# Architecture

## Overview

SixBee HealthTech appointment booking system — a patient-facing form and an admin area behind authentication.

## Tech Stack

| Layer       | Technology              | Why                                                      |
|-------------|-------------------------|----------------------------------------------------------|
| Frontend    | Next.js 16 + Tailwind 4 | Server-side rendering, App Router, utility-first CSS     |
| Backend     | NestJS 11               | Opinionated Node framework with modules/providers/guards |
| Database    | PostgreSQL 16           | Robust relational DB, required by spec                   |
| Migrations  | Knex                    | Schema management with versioned migrations              |
| Testing     | Vitest + RTL            | Fast, modern test runner across both projects             |
| Containers  | Docker Compose          | Reproducible dev environment, one command to run          |
| CI          | GitHub Actions          | Lint, test, audit on every push                          |

## Project Structure

```
├── backend/                 # NestJS API (port 3001)
│   ├── src/
│   │   ├── main.ts          # Bootstrap + Helmet, CORS
│   │   ├── app.module.ts    # Root module
│   │   ├── appointments/    # Appointment CRUD module
│   │   ├── auth/            # JWT auth module
│   │   └── encryption/      # AES-256-GCM encryption service
│   ├── migrations/          # Knex migration files
│   ├── seeds/               # Admin user seeder
│   └── vitest.config.ts
├── frontend/                # Next.js app (port 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Patient booking form
│   │   │   ├── admin/               # Admin area (login, table, edit)
│   │   │   └── layout.tsx           # Root layout
│   │   ├── components/              # Shared UI components
│   │   └── __tests__/               # Vitest + React Testing Library
│   └── vitest.config.ts
├── docker-compose.yml       # PostgreSQL + backend + frontend
├── .github/workflows/ci.yml # CI pipeline
└── docs/
    ├── ASSIGNMENT.md         # Original spec
    └── ARCHITECTURE.md       # This file
```

## Security Design

- **Encryption at rest** — All PII fields (name, email, phone, description) encrypted with AES-256-GCM before storage. The database holds ciphertext; decryption happens in the API layer.
- **Password hashing** — BCrypt (10 rounds) for admin credentials.
- **Authentication** — JWT with 8-hour expiry. Protected routes use NestJS Guards.
- **Input validation** — Zod schemas validate all API inputs. Parameterised queries via Knex prevent SQL injection.
- **HTTP hardening** — Helmet middleware sets security headers. CORS configured to allow only the frontend origin.

## Database Schema

```
┌─────────────────────────┐       ┌─────────────────────────┐
│      appointments       │       │        admin_users      │
├─────────────────────────┤       ├─────────────────────────┤
│ id           UUID  PK   │       │ id           UUID  PK   │
│ name         TEXT (enc) │       │ email        VARCHAR    │
│ email        TEXT (enc) │       │ password     VARCHAR    │
│ phone        TEXT (enc) │       │ is_active    BOOLEAN    │  (default true)
│ description  TEXT (enc) │       │ created_at   TIMESTAMP  │
│ date_time    TIMESTAMP  │       │ updated_at   TIMESTAMP  │
│                         │       └─────────────────────────┘
│ status       VARCHAR    │  (pending | approved)
│ metadata     JSONB      │  (extensible without migrations)
│ created_at   TIMESTAMP  │
│ updated_at   TIMESTAMP  │
└─────────────────────────┘

┌──────────────────────────────┐
│          audit_log           │
├──────────────────────────────┤
│ id             UUID  PK      │
│ appointment_id UUID  FK      │  → appointments.id (nullable for deletes)
│ admin_user_id  UUID  FK      │  → admin_users.id
│ action         VARCHAR       │  (created | approved | edited | deleted)
│ changes        TEXT   (enc)  │  (JSON diff of before/after, encrypted)
│ created_at     TIMESTAMP     │
└──────────────────────────────┘
```

PII fields are stored as AES-256-GCM ciphertext (base64-encoded IV + authTag + ciphertext). The `date_time` field is stored unencrypted to allow ordering by appointment date. The `metadata` JSONB column allows extending appointment data without schema migrations.

The `audit_log` table provides a full trace of every admin action. The `changes` column stores an encrypted JSON diff of the before/after state, ensuring PII remains protected even in the audit trail. The `appointment_id` is nullable to retain audit records after an appointment is deleted.

## Data Flow

```
Patient Form ──POST /appointments──▶ Validate (Zod)
                                      │
                                      ▼
                                  Encrypt PII
                                      │
                                      ▼
                                  Insert into DB
                                      │
                                      ▼
                                  Return 201

Admin Table ───GET /appointments──▶ Verify JWT
                                      │
                                      ▼
                                  Query DB (ordered by date_time)
                                      │
                                      ▼
                                  Decrypt PII
                                      │
                                      ▼
                                  Return JSON
```

## Testing Strategy

All tests follow **AAA (Arrange-Act-Assert)** pattern with **TDD (red-green-refactor)**.

- **Backend integration tests** — Run against real PostgreSQL in Docker. No mocking the database.
- **Frontend unit tests** — Vitest + React Testing Library with happy-dom.
- **CI** — GitHub Actions runs lint, test, and `npm audit` for both projects on every push.

## Running Locally

```bash
# Start all services
docker compose up

# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# Postgres: localhost:5432
```
