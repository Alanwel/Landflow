#!/usr/bin/env bash
# ===========================================================================
# verify-rls.sh — run the LandFlow RLS policy tests on a REAL Postgres.
#
# This does NOT need Docker and does NOT need the Supabase CLI. It starts a
# throwaway cluster, loads the test schema, and reports pass/fail.
#
#   ./supabase/verify-rls.sh
#
# Requires: postgresql + postgresql-15-pgtap installed.
# On Ubuntu/Termux:  sudo apt install postgresql postgresql-15-pgtap
# ===========================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS="$SCRIPT_DIR/rls-tests.sql"

command -v psql >/dev/null 2>&1 || { echo "psql not found. Install: apt install postgresql"; exit 1; }
[ -f "$TESTS" ] || { echo "Cannot find $TESTS"; exit 1; }

# Start a cluster if one is not already running.
PG_BIN="$(dirname "$(command -v psql)")"
PGDATA="${PGDATA:-/tmp/landflow-pgdata}"
PORT="${PGPORT:-55432}"

if ! pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
  echo "==> Starting a temporary Postgres cluster on port $PORT"
  if [ ! -d "$PGDATA" ]; then
    initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null 2>&1 || {
      echo "initdb failed"; exit 1;
    }
  fi
  pg_ctl -D "$PGDATA" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" \
    -l /tmp/landflow-pg.log start >/dev/null 2>&1

  for _ in $(seq 1 20); do
    pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1 && break
    sleep 1
  done
  if ! pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
    echo "Could not start Postgres. Log: /tmp/landflow-pg.log"; exit 1
  fi
  echo "==> Cluster up"
fi

PSQL="psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=0 -q"

echo "==> Running RLS policy tests"
$PSQL -d postgres -f "$TESTS" 2>&1 | tee /tmp/landflow-rls.out

# Count TAP results
PASS=$(grep -cE '^ok [0-9]+' /tmp/landflow-rls.out || true)
FAIL=$(grep -cE '^not ok [0-9]+' /tmp/landflow-rls.out || true)

echo
echo "==================================="
echo "  passed: ${PASS:-0}   failed: ${FAIL:-0}"
echo "==================================="

if [ "${FAIL:-0}" -gt 0 ]; then
  echo "FAILED — see the 'not ok' lines above."
  exit 1
fi
echo "All RLS policy tests passed."
