begin;
select plan(4);
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
insert into public.tasks (category_id, title, content) values (1, '첨부 테스트', '가상 내용');
create temp table t_task on commit drop as select id from public.tasks;
grant select on t_task to authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name) select 'attachments', id::text || '/f1-가상.txt' from t_task$$,
  '회원: 업무 폴더에 업로드');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-000000000000/x.txt')$$,
  '42501', null, '존재하지 않는 업무 폴더 업로드 불가');
select throws_ok(
  $$insert into public.attachments (task_id, storage_path, file_name, mime_type, size_bytes)
     select id, 'other/x.txt', 'x.txt', 'text/plain', 10 from t_task$$,
  '23514', null, '첨부 경로는 업무 ID 로 시작해야 함');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'attachments'), 0, '비회원: 첨부파일 조회 불가');
select pg_temp.logout();

select * from finish();
rollback;
