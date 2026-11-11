-- =====================================================================
-- OMS 0003: 권한(GRANT) · RLS 정책
-- Supabase 는 public 스키마의 새 테이블에 anon/authenticated 전체 권한을 기본 부여하므로
-- 먼저 모두 회수한 뒤 필요한 권한만 컬럼 단위로 다시 준다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 함수 실행 권한
-- ---------------------------------------------------------------------
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.is_admin() to authenticated;

revoke all on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 테이블 권한
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.categories, public.tasks,
              public.task_logs, public.task_comments, public.attachments
  from anon, authenticated;

grant select on public.profiles, public.categories, public.tasks,
                public.task_logs, public.task_comments, public.attachments
  to authenticated;

-- 본인 표시 이름만 수정 (활성/권한 변경은 admin_set_user_active, 생성은 service role)
grant update (display_name) on public.profiles to authenticated;

-- 업무 유형: 관리자만 (정책에서 판정). 삭제 대신 is_active=false.
grant insert (name, sort_order, is_active) on public.categories to authenticated;
grant update (name, sort_order, is_active) on public.categories to authenticated;

-- 업무: 시스템 컬럼(task_no, created_by, completed_at, ...)은 권한 자체가 없음
grant insert (category_id, title, content, requester, status, priority, assignee_id, due_date)
  on public.tasks to authenticated;
grant update (category_id, title, content, requester, status, priority, assignee_id, due_date,
              resolution, version)
  on public.tasks to authenticated;

-- 처리 이력·첨부: 추가만. author_id / uploaded_by 는 DEFAULT auth.uid() 로만 채워진다.
grant insert (task_id, body) on public.task_comments to authenticated;
grant insert (task_id, comment_id, storage_path, file_name, mime_type, size_bytes)
  on public.attachments to authenticated;

-- task_logs 는 트리거(SECURITY DEFINER)만 기록한다. DELETE/TRUNCATE 권한은 누구에게도 주지 않는다.

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_logs     enable row level security;
alter table public.task_comments enable row level security;
alter table public.attachments   enable row level security;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated using ((select private.is_member()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_member()))
  with check (id = (select auth.uid()));

-- categories
create policy categories_select on public.categories
  for select to authenticated using ((select private.is_member()));
create policy categories_insert_admin on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy categories_update_admin on public.categories
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- tasks (DELETE 정책 없음)
create policy tasks_select on public.tasks
  for select to authenticated using ((select private.is_member()));
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks
  for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

-- task_logs (조회만)
create policy task_logs_select on public.task_logs
  for select to authenticated using ((select private.is_member()));

-- task_comments (조회·추가만)
create policy task_comments_select on public.task_comments
  for select to authenticated using ((select private.is_member()));
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check ((select private.is_member()) and author_id = (select auth.uid()));

-- attachments (조회·추가만)
create policy attachments_select on public.attachments
  for select to authenticated using ((select private.is_member()));
create policy attachments_insert on public.attachments
  for insert to authenticated
  with check ((select private.is_member()) and uploaded_by = (select auth.uid()));
