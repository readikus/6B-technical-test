# Demo Setup — Backend Switcher

Run the full demo with all three backends + the Next.js frontend with backend switcher.

## Quick Start (one command)

```bash
cd /Users/ianread/Code/tmp-6b/6B-technical-test

# 1. Fetch and checkout the backend-switcher frontend branch
git fetch origin feature/backend-switcher claude/festive-elbakyan
git checkout feature/backend-switcher && git pull

# 2. Bring up all backends + frontend
docker compose down -v && docker compose up --build
```

Then visit: **http://localhost:3000/demo**

## What's Running

| Service | Port | Branch | Stack |
|---------|------|--------|-------|
| PostgreSQL | 5432 | — | Postgres 16 |
| NestJS API | 3001 | `improved-ux` | Node.js + TypeScript |
| Spring Boot API | 3002 | `improved-ux` | Java 21 |
| .NET API + Blazor | 3004 | `claude/festive-elbakyan` | .NET 10 + C# |
| Next.js Frontend | 3000 | `feature/backend-switcher` | Next.js 16 + Tailwind |

## How the Demo Works

1. Visit `http://localhost:3000/demo` — activates demo mode
2. An amber **DEMO** badge and dropdown appears in the nav bar
3. Select any backend — the page reloads and all API calls hit that backend
4. Book an appointment on one backend, switch, see it on another (same database)
5. Login works on each backend independently (same admin credentials)

## If Docker Isn't Available

Run the frontend separately:

```bash
# Terminal 1: Start databases + backends
docker compose up db backend backend-dotnet

# Terminal 2: Run frontend in dev mode
cd frontend && npm install && npm run dev
```

## Troubleshooting

**CORS errors when switching backends:**
Ensure the backend you're switching to is actually running. Check `docker compose ps`.

**.NET backend not starting:**
Check `docker compose logs backend-dotnet` for startup errors (usually database connectivity).

**Login fails after switching:**
Each backend has its own auth cookies. Switching backends requires re-login — the page reload handles this.

## Cleanup

```bash
# Stop everything and remove volumes
docker compose down -v

# Disable demo mode
# Visit http://localhost:3000/demo and click "Disable Demo Mode"
# Or clear localStorage in browser dev tools
```
