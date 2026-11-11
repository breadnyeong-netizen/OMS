#!/usr/bin/env bash
# 실제 동시 접속으로 정합성 검증 (pgTAP 은 단일 세션이라 불가)
#  1) 활성 사용자 2명 제한: 동시에 2명 추가 → 1명만 성공
#  2) 업무번호: 20개 세션이 동시에 5건씩 등록 → 100건, 1~100 중복·누락 없음
#  3) 낙관적 잠금: 같은 version 으로 동시 수정 → 1건만 성공, 다른 1건은 40001
set -uo pipefail
DB="$1"
q() { psql -X -q -t -A -d "$DB" "$@"; }
ADMIN=c0000000-0000-4000-8000-000000000001
login="select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\"}', true); set local role authenticated;"
fail=0
check() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (기대: $3, 실제: $2)"; fail=1; fi; }

echo "✓ 동시성 테스트"
q -c "insert into auth.users (id, email) values
  ('$ADMIN','c1@oms.local'),('c0000000-0000-4000-8000-000000000002','c2@oms.local'),('c0000000-0000-4000-8000-000000000003','c3@oms.local');
  insert into public.profiles (id, username, display_name, role) values ('$ADMIN','conc_admin','동시성관리자','admin');" >/dev/null

# 1) 사용자 수 제한
for n in 2 3; do
  q -c "begin; insert into public.profiles (id, username, display_name)
        values ('c0000000-0000-4000-8000-00000000000$n','conc_u$n','사용자$n'); select pg_sleep(0.5); commit;" >/dev/null 2>&1 &
done
wait
check "동시 초대 2건 중 1건만 성공 (활성 2명)" "$(q -c "select count(*) from public.profiles where is_active and username like 'conc_%'")" "2"

# 2) 업무번호 동시 발급
for s in $(seq 1 20); do
  (for i in 1 2 3 4 5; do
     q -c "begin; $login insert into public.tasks (category_id, title, content) values (1, '동시 $s-$i', '가상'); select pg_sleep(random()*0.02); commit;" >/dev/null 2>&1
   done) &
done
wait
check "동시 등록 100건 저장" "$(q -c "select count(*) from public.tasks")" "100"
check "업무번호 중복 없음" "$(q -c "select count(distinct task_no) from public.tasks")" "100"
check "순번 1~100 연속" "$(q -c "select min(task_seq)||'-'||max(task_seq) from public.tasks")" "1-100"

# 3) 낙관적 잠금
TID="$(q -c "select id from public.tasks where task_seq = 1")"
OUT1=$(mktemp); OUT2=$(mktemp)
q -c "begin; $login update public.tasks set status='in_progress', version=1 where id='$TID'; select pg_sleep(0.7); commit;" >"$OUT1" 2>&1 &
sleep 0.2
q -c "begin; $login update public.tasks set status='on_hold', version=1 where id='$TID'; commit;" >"$OUT2" 2>&1 &
wait
check "먼저 수정한 요청 반영" "$(q -c "select status||':'||version from public.tasks where id='$TID'")" "in_progress:2"
check "늦은 요청은 충돌 오류" "$(grep -c '다른 사용자가 먼저 수정했습니다' "$OUT2")" "1"
check "상태 변경 이력은 1건만" "$(q -c "select count(*) from public.task_logs where task_id='$TID' and action='status_changed'")" "1"
rm -f "$OUT1" "$OUT2"
exit $fail
