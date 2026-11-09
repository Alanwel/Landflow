#!/usr/bin/env bash
# ===========================================================================
# verify-rls-remote.sh — run the LandFlow RLS policy tests against a REMOTE
# database (Supabase) instead of a local cluster.
#
# WHY THIS EXISTS
#   verify-rls.sh needs a local Postgres. On a phone (Termux) that is a
#   painful install, and on CI it is a whole extra service. But the tests
#   do not need a *local* database — they need a *real* Postgres.
#
#   The suite creates its own `rls_test` schema, runs every assertion, and
#   ROLLS BACK. Your real tables are never touched. That makes it safe to
#   point at production.
#
# HOW TO RUN
#   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
#     ./supabase/verify-rls-remote.sh
#
# Needs: psql  (Termux: pkg install postgresql)
# ===========================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS="$SCRIPT_DIR/rls-tests.sql"

command -v psql >/dev/null 2>&1 || {
  echo "psql not found. Install: pkg install postgresql   (or: apt install postgresql-client)"; exit 1; }
[ -f "$TESTS" ] || { echo "Cannot find $TESTS"; exit 1; }
[ -n "${DATABASE_URL:-}" ] || {
  echo "DATABASE_URL is not set."
  echo "  export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres'"
  exit 1; }

OUT=/tmp/landflow-rls-remote.out

echo "==> Running RLS policy tests against the remote database"
# ON_ERROR_STOP=0 so one failing assertion does not abort the whole file.
# The file wraps itself in begin/rollback, so nothing is left behind.
# -A -t = unaligned, tuples-only. That prints ONE TAP line per row:
#   "ok 12 - the owner sees their own profile row"
# Without it psql draws a pretty table and every line starts with a space,
# so the "^ok " pattern below never matches and the script reports 0 tests.
PGCONNECT_TIMEOUT=15 psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -q -A -t -f "$TESTS" 2>&1 | tee "$OUT"

PASS=$(grep -cE '^ok [0-9]+' "$OUT" || true)
FAIL=$(grep -cE '^not ok [0-9]+' "$OUT" || true)

echo
echo "==================================="
echo "  passed: ${PASS:-0}   failed: ${FAIL:-0}"
echo "==================================="

if [ "${FAIL:-0}" -gt 0 ]; then
  echo "FAILED — see the 'not ok' lines above."
  exit 1
fi
if [ "${PASS:-0}" -eq 0 ]; then
  echo "No TAP output at all — the test file probably did not run."
  echo "Check that the database role can create a schema and the pgtap extension:"
  echo "  create extension if not exists pgtap with schema rls_test;"
  exit 1
fi
echo "All RLS policy tests passed."
