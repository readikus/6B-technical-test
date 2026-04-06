# SixBee HealthTech — Appointment Booking System

A patient appointment booking system for SixBee HealthTech. Patients request appointments via a public form. Practice staff manage, approve, edit, and delete appointments through a protected admin area.

## Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Frontend       | Next.js 16, Tailwind CSS 4, TypeScript |
| Backend API    | NestJS 11, TypeScript             |
| Database       | PostgreSQL 16                     |
| Migrations     | Knex                              |
| Testing        | Vitest, React Testing Library     |
| Containerisation | Docker Compose                  |
| CI             | GitHub Actions                    |

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd 6B-Technical-Test
cp .env.example .env
```

Edit `.env` to set your admin credentials and secrets:

```bash
# .env — the values you'll want to change:
ADMIN_EMAIL=admin@sixbee.health    # Admin login email
ADMIN_PASSWORD=changeme            # Admin login password
JWT_SECRET=your-secret-here        # JWT signing key
ENCRYPTION_KEY=your-32-byte-key    # AES-256 encryption key for PII at rest
```

### 2. Start everything

```bash
docker compose up --build
```

This starts PostgreSQL, runs database migrations, seeds the admin user, and boots both the API and frontend.

### 3. Use the application

| What                  | URL                          |
|-----------------------|------------------------------|
| Patient booking form  | http://localhost:3000         |
| Admin login           | http://localhost:3000/admin   |
| Backend API           | http://localhost:3001         |
| API documentation     | http://localhost:3001/api/docs |

Log in to the admin area using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` file.

## Environment Variables

All configuration is via environment variables. Defaults are provided for local development.

| Variable           | Default                | Description                                   |
|--------------------|------------------------|-----------------------------------------------|
| `POSTGRES_USER`    | `sixbee`               | Database username                             |
| `POSTGRES_PASSWORD`| `changeme`             | Database password                             |
| `POSTGRES_DB`      | `sixbee_health`        | Database name                                 |
| `POSTGRES_PORT`    | `5432`                 | Host port for PostgreSQL                      |
| `BACKEND_PORT`     | `3001`                 | Host port for the API                         |
| `FRONTEND_PORT`    | `3000`                 | Host port for the frontend                    |
| `JWT_SECRET`       | `dev-jwt-secret`       | Secret used to sign JWT tokens                |
| `ENCRYPTION_KEY`   | *(dev default)*        | 32-byte key for AES-256-GCM encryption at rest|
| `ADMIN_EMAIL`      | `admin@sixbee.health`  | Seeded admin user email                       |
| `ADMIN_PASSWORD`   | `changeme`             | Seeded admin user password (BCrypt hashed)    |

## Running Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

## Local CI with `act`

Run the GitHub Actions workflow locally before pushing:

```bash
act --container-architecture linux/amd64                    # run all jobs
act -j backend --container-architecture linux/amd64         # run just the backend job
act -j frontend-unit --container-architecture linux/amd64   # run just the frontend job
```

> **Apple Silicon note:** The `--container-architecture linux/amd64` flag is required on M-series Macs. Without it, container jobs may fail silently or with architecture-related errors.

### Regenerating lock files

If `npm ci` fails in CI with "Missing: … from lock file" errors, the lock files need regenerating. This happens when dependencies are resolved on macOS and platform-specific transitive deps are omitted:

```bash
cd frontend && rm -rf node_modules package-lock.json && npm install
cd ../backend && rm -rf node_modules package-lock.json && npm install
```

Then re-run `act` to verify before pushing.

## Project Structure

```
├── backend/                 # NestJS API (port 3001)
├── frontend/                # Next.js app (port 3000)
├── docker-compose.yml       # PostgreSQL + API + frontend
├── .github/workflows/       # CI pipeline
└── docs/
    ├── ASSIGNMENT.md        # Original brief
    └── ARCHITECTURE.md      # Architecture & design decisions
```

For security design, database schema, and data flow diagrams see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Clean Build

To tear everything down and start fresh (including database data):

```bash
docker compose down -v
docker compose up --build
```

This will:
1. Remove all containers and the PostgreSQL data volume
2. Rebuild both services from scratch
3. Run database migrations to create all tables
4. Seed the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in your `.env`
