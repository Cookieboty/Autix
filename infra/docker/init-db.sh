#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE autix_chat;
    CREATE DATABASE user_system;
    \c autix_chat
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
