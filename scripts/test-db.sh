#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL instance and runs the SQL
# tests in supabase/tests. Needs PostgreSQL 15+ binaries (initdb, pg_ctl, psql)
# on PATH or in $PG_BIN. Nothing here touches a real Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(sudo -u postgres); fi

WORK="$(mktemp -d)"
chmod 777 "$WORK"
PORT="${PGTEST_PORT:-55432}"
cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("${RUN_AS[@]}" "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/_auth_stub.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done
for test in "$ROOT"/supabase/tests/*.test.sql; do
  echo "test: $(basename "$test")"
  "${PSQL[@]}" -o /dev/null -f "$test"
done
