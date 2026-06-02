#!/bin/bash
set -e

DB_EXISTS=$(psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'autix'" --username "$POSTGRES_USER")

if [ "$DB_EXISTS" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE DATABASE autix"
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname=autix -c \
  "CREATE EXTENSION IF NOT EXISTS vector"
