#!/usr/bin/env bash
# 로컬 PostgreSQL 에 shim + 마이그레이션을 적용하고 pgTAP 테스트와 동시성 테스트를 실행한다.
# 사용: PGHOST=... PGPORT=... PGUSER=postgres scripts/db/test.sh
# (Supabase CLI 사용 시에는 `supabase db reset && supabase test db` 로 대체)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${OMS_TEST_DB:-oms_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

dropdb --if-exists "$DB" >/dev/null
createdb "$DB"
"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/db/supabase-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done
"${PSQL[@]}" -d "$DB" -c "create extension if not exists pgtap with schema extensions" >/dev/null
echo "✓ 마이그레이션 적용 완료"

fail=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  out="$(psql -X -q -t -A -d "$DB" -c "set search_path = public, extensions" -f "$t" 2>&1 || true)"
  if grep -qE '^not ok|ERROR|Looks like' <<<"$out"; then
    echo "✗ $(basename "$t")"; grep -E '^not ok|ERROR|#' <<<"$out" | sed 's/^/    /'; fail=1
  else
    echo "✓ $(basename "$t") ($(grep -c '^ok' <<<"$out")개 통과)"
  fi
done

"$ROOT/scripts/db/concurrency.sh" "$DB" || fail=1
exit $fail
