begin;
select plan(30);
-- ── 공통 가상 사용자 ────────────────────────────────────────────
--   admin    : 관리자 (활성)
--   member   : 일반 사용자 (활성)
--   outsider : 로그인 계정은 있으나 profile 없음 (초대되지 않은 사용자)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@oms.local'),
  ('a0000000-0000-4000-8000-000000000002', 'member@oms.local'),
  ('a0000000-0000-4000-8000-000000000003', 'outsider@oms.local'),
  ('a0000000-0000-4000-8000-000000000004', 'third@oms.local');
insert into public.profiles (id, username, display_name, role) values
  ('a0000000-0000-4000-8000-000000000001', 'admin01', '가상관리자', 'admin'),
  ('a0000000-0000-4000-8000-000000000002', 'member01', '가상사용자', 'member');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end $f$;

create function pg_temp.logout() returns void language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $f$;

select pg_temp.login('a0000000-0000-4000-8000-000000000002');

-- ── 업무번호 ──────────────────────────────────────────────────
select throws_ok($$insert into public.tasks (category_id, title, content, task_year, task_seq)
  values (1, '번호 지정', '번호 지정', 1999, 777)$$, '42501', null, '클라이언트가 업무번호 지정 불가');
insert into public.tasks (category_id, title, content) values (1, '가상 문의 A', '가상 내용 A');
insert into public.tasks (category_id, title, content, priority) values (2, '가상 오류 B', '가상 내용 B', 'high');

create temp table t_ids on commit drop as
  select task_no, id from public.tasks order by task_seq;
grant select on t_ids to authenticated;

select is((select task_no from t_ids limit 1),
  'OMS-' || extract(year from now() at time zone 'Asia/Seoul')::text || '-0001', '첫 업무번호 OMS-YYYY-0001');
select is((select task_no from t_ids offset 1 limit 1),
  'OMS-' || extract(year from now() at time zone 'Asia/Seoul')::text || '-0002', '두 번째 업무번호 0002');
select throws_ok($$insert into public.tasks (category_id, title, content, status) values (1, 'x', 'x', 'done')$$,
  '23514', null, '완료 상태로 신규 등록 불가');
select is((select action || ':' || to_value from public.task_logs where task_id = (select id from t_ids limit 1)),
  'created:received', '등록 이력 자동 기록');

-- ── 상태 변경 이력 ────────────────────────────────────────────
update public.tasks set status = 'in_progress', version = 1 where id = (select id from t_ids limit 1);
select results_eq(
  $$select action, from_value, to_value, actor_id from public.task_logs
     where task_id = (select id from t_ids limit 1) and action = 'status_changed'$$,
  $$values ('status_changed'::text, 'received'::text, 'in_progress'::text, 'a0000000-0000-4000-8000-000000000002'::uuid)$$,
  '상태 변경: 이전/변경 상태와 변경자 기록');
select is((select version from public.tasks where id = (select id from t_ids limit 1)), 2, '수정 시 version 증가');

-- ── 낙관적 잠금 ───────────────────────────────────────────────
select throws_ok($$update public.tasks set title = '덮어쓰기', version = 1 where id = (select id from t_ids limit 1)$$,
  '40001', null, '오래된 version 으로 수정 시 충돌 오류');

-- ── 완료 처리 ─────────────────────────────────────────────────
select throws_ok($$update public.tasks set status = 'done', version = 2 where id = (select id from t_ids limit 1)$$,
  '23514', null, '처리 결과 없이 완료 불가');
select throws_ok($$update public.tasks set status = 'done', resolution = '   ', version = 2 where id = (select id from t_ids limit 1)$$,
  '23514', null, '공백 처리 결과로 완료 불가');
update public.tasks set status = 'done', resolution = '가상 처리 결과 1', version = 2 where id = (select id from t_ids limit 1);
select isnt((select completed_at from public.tasks where id = (select id from t_ids limit 1)), null, '완료일시 자동 기록');
select is((select completed_by from public.tasks where id = (select id from t_ids limit 1)), 'a0000000-0000-4000-8000-000000000002'::uuid, '완료자 자동 기록');
select is((select detail->>'resolution' from public.task_logs
           where task_id = (select id from t_ids limit 1) and to_value = 'done'),
  '가상 처리 결과 1', '완료 이력에 처리 결과 기록');

-- ── 재개 ──────────────────────────────────────────────────────
update public.tasks set status = 'in_progress', version = 3 where id = (select id from t_ids limit 1);
select is((select completed_at from public.tasks where id = (select id from t_ids limit 1)), null, '재개 시 완료일시 해제');
select is((select resolution from public.tasks where id = (select id from t_ids limit 1)), null, '재개 시 업무의 처리 결과 비움');
select is((select reopen_count from public.tasks where id = (select id from t_ids limit 1)), 1, '재개 횟수 증가');
select is((select detail->>'previous_resolution' from public.task_logs
           where task_id = (select id from t_ids limit 1) and from_value = 'done'),
  '가상 처리 결과 1', '재개 이력에 직전 처리 결과 보존');
select is((select count(*)::int from public.task_logs
           where task_id = (select id from t_ids limit 1) and action = 'status_changed'),
  3, '상태 변경 이력 3건 모두 보존');

-- ── 기타 변경 이력 ────────────────────────────────────────────
update public.tasks set assignee_id = 'a0000000-0000-4000-8000-000000000001', priority = 'urgent', title = '가상 문의 A(수정)', version = 4
 where id = (select id from t_ids limit 1);
select is((select to_value from public.task_logs where task_id = (select id from t_ids limit 1) and action = 'assignee_changed'),
  'a0000000-0000-4000-8000-000000000001', '담당자 변경 기록');
select is((select from_value || '>' || to_value from public.task_logs where task_id = (select id from t_ids limit 1) and action = 'priority_changed'),
  'normal>urgent', '우선순위 변경 기록');
select is((select detail->'title'->>'to' from public.task_logs where task_id = (select id from t_ids limit 1) and action = 'edited'),
  '가상 문의 A(수정)', '제목 수정 기록');
select pg_temp.logout();

-- ── service role / 관리자 DB 접속이라도 이력은 보존 ───────────
select throws_ok('delete from public.task_logs', '42501', null, 'DB 관리자도 처리 기록 삭제 불가');
select throws_ok('truncate public.task_logs', '42501', null, 'DB 관리자도 처리 기록 TRUNCATE 불가');
select throws_ok('delete from public.tasks', '42501', null, 'DB 관리자도 업무 삭제 불가');
select throws_ok($$update public.tasks set title = 'x'$$, '42501', null, '사용자 컨텍스트 없는 업무 수정 불가');

-- ── 사용자 2명 제한 · 비활성 사용자 차단 ─────────────────────
select throws_ok(
  $$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000004', 'third01', '세번째')$$,
  'P0001', '활성 사용자는 최대 2명까지 허용됩니다.', '세 번째 활성 사용자 생성 불가');

select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.categories (name, sort_order) values ('가상 유형', 50)$$, '관리자: 업무 유형 추가');
select throws_ok($$select public.admin_set_user_active('a0000000-0000-4000-8000-000000000001', false)$$, 'P0001', null, '관리자 자기 비활성화 불가');
select lives_ok($$select public.admin_set_user_active('a0000000-0000-4000-8000-000000000002', false)$$, '관리자: 사용자 비활성화');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.tasks), 0, '비활성 사용자: 업무 조회 차단');
select pg_temp.logout();

select * from finish();
rollback;
