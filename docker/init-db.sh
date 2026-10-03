#!/usr/bin/env bash
# Docker Compose init script: creates both databases if they don't exist.
# Runs inside the postgres container on first boot (mounted as initdb.d script).

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE spareroute_db'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'spareroute_db')\gexec

  SELECT 'CREATE DATABASE inquest_db'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inquest_db')\gexec
EOSQL
