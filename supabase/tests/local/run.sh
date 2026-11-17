#!/usr/bin/env bash
# Rejoue toutes les migrations sur une base Postgres locale vierge, puis exécute les tests pgTAP.
# Usage : PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/local/run.sh
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DB="${TEST_DB:-flowdsiml_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
export PGDATABASE="$DB"
psql -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/tests/local/supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
done
# Ré-application : les migrations doivent être idempotentes.
for f in "$ROOT"/supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null; done
echo "→ migrations idempotentes"
status=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "→ $(basename "$t")"
  out=$(psql -v ON_ERROR_STOP=1 -X -tA -f "$t" 2>&1) || status=1
  echo "$out" | grep -E '^(not ok|ok|#|1\.\.)' || true
  echo "$out" | grep -qE '^not ok|Looks like' && status=1
  echo "$out" | grep -qi 'error' && { echo "$out" | grep -i error; status=1; }
done
exit $status
