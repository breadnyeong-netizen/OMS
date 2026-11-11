begin;
select plan(26);
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

-- 가상 업무 1건 (member 로 등록)
select pg_temp.login('a0000000-0000-4000-8000-000000000002');
insert into public.tasks (category_id, title, content)
values ((select id from public.categories where name = '오류 처리'), '가상 오류 업무', '가상 요청 내용');
select pg_temp.logout();

-- ── 비로그인(anon) ─────────────────────────────────────────────
set local role anon;
select throws_ok('select * from public.tasks', '42501', null, 'anon: 업무 조회 불가');
select throws_ok('select * from public.profiles', '42501', null, 'anon: 사용자 조회 불가');
select throws_ok('select * from public.task_comments', '42501', null, 'anon: 처리 이력 조회 불가');
reset role;

-- ── 초대되지 않은 로그인 사용자 ────────────────────────────────
select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.tasks), 0, '비회원: 업무 0건 조회');
select is((select count(*)::int from public.profiles), 0, '비회원: 사용자 0건 조회');
select is((select count(*)::int from public.task_logs), 0, '비회원: 기록 0건 조회');
select throws_ok(
  $$insert into public.tasks (category_id, title, content) values (1, '침입', '침입')$$,
  '42501', null, '비회원: 업무 등록 불가');
select is((select count(*)::int from storage.objects), 0, '비회원: 첨부파일 0건 조회');
select pg_temp.logout();

-- ── 회원 공통 공개 ─────────────────────────────────────────────
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.tasks), 1, '관리자: member 가 등록한 업무 조회 (공동 공개)');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000002');
select is((select created_by from public.tasks limit 1), 'a0000000-0000-4000-8000-000000000002'::uuid, '등록자는 서버가 auth.uid() 로 기록');

-- ── 보호 컬럼 · 직접 기록 차단 ─────────────────────────────────
select throws_ok($$update public.tasks set created_by = 'a0000000-0000-4000-8000-000000000001'$$, '42501', null, '등록자 변경 불가 (컬럼 권한)');
select throws_ok($$update public.tasks set completed_at = now()$$, '42501', null, '완료일시 직접 입력 불가');
select throws_ok($$update public.tasks set task_seq = 99$$, '42501', null, '업무번호 변경 불가');
select throws_ok(
  $$insert into public.task_logs (task_id, action, actor_id) select id, 'edited', 'a0000000-0000-4000-8000-000000000002' from public.tasks$$,
  '42501', null, '처리 기록 직접 추가 불가');
select throws_ok('delete from public.tasks', '42501', null, '업무 삭제 불가');
select throws_ok('update public.task_logs set to_value = null', '42501', null, '처리 기록 수정 불가');
select throws_ok('delete from public.task_logs', '42501', null, '처리 기록 삭제 불가');

-- ── 처리 이력 ─────────────────────────────────────────────────
select lives_ok(
  $$insert into public.task_comments (task_id, body) select id, '가상 처리 내용' from public.tasks$$,
  '회원: 처리 이력 추가');
select throws_ok(
  $$insert into public.task_comments (task_id, author_id, body) select id, 'a0000000-0000-4000-8000-000000000001', '사칭' from public.tasks$$,
  '42501', null, '작성자 사칭 불가');
select throws_ok('update public.task_comments set body = ''수정''', '42501', null, '처리 이력 수정 불가');
select throws_ok('delete from public.task_comments', '42501', null, '처리 이력 삭제 불가');

-- ── 사용자·업무 유형 관리 ─────────────────────────────────────
select lives_ok($$update public.profiles set display_name = '새이름' where id = 'a0000000-0000-4000-8000-000000000002'$$, '본인 표시 이름 변경');
update public.profiles set display_name = '탈취' where id = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select display_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), '가상관리자', '타인 표시 이름은 변경되지 않음');

select pg_temp.login('a0000000-0000-4000-8000-000000000002');
select throws_ok($$update public.profiles set role = 'admin'$$, '42501', null, '자기 권한 상승 불가');
select throws_ok($$insert into public.categories (name) values ('새유형')$$, '42501', null, '일반 사용자: 업무 유형 추가 불가');
select throws_ok($$select public.admin_set_user_active('a0000000-0000-4000-8000-000000000001', false)$$, '42501', null, '일반 사용자: 관리자 기능 불가');
select pg_temp.logout();

select * from finish();
rollback;
