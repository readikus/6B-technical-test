#!/bin/sh
# Docker entrypoint for the backend service.
# Runs Knex database migrations and seeds before starting the application.
# This ensures the schema is up to date and the admin user exists on every
# container start, making the app ready to use with a single `docker compose up`.
set -e

echo "Running database migrations..."
npx knex migrate:latest --knexfile knexfile.ts

echo "Running database seeds..."
npx knex seed:run --knexfile knexfile.ts

echo "Starting application..."
exec "$@"
