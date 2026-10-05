#!/bin/bash
set -e

# Wait for postgres to be ready
echo "Seeding the database..."
export PGPASSWORD=postgres
psql -h localhost -p 5432 -U postgres -d trusttrove -f indexer/scripts/seed.sql
echo "Seeding completed."
