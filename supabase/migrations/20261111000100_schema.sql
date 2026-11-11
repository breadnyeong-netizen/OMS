-- =====================================================================
-- OMS 0001: 스키마 (테이블 · 제약조건 · 인덱스)
-- 설계: docs/DESIGN.md 2장
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- RLS 헬퍼 등 API로 노출하지 않을 함수용 스키마
create schema if not exists private;

-- ---------------------------------------------------------------------
-- profiles: 초대된 사용자 (최대 2명). 로그인은 아이디(username) 기반.
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete restrict,
  username     text not null,
  display_name text not null,
  role         text not null default 'member',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9_.-]{2,19}$'),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 50),
  constraint profiles_role_check check (role in ('admin', 'member'))
);
comment on table public.profiles is '초대된 OMS 사용자. 활성 사용자는 최대 2명.';

-- ---------------------------------------------------------------------
-- categories: 업무 유형
-- ---------------------------------------------------------------------
create table public.categories (
  id         smallint generated always as identity primary key,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint categories_name_key unique (name),
  constraint categories_name_len check (char_length(btrim(name)) between 1 and 30)
);

insert into public.categories (name, sort_order) values
  ('사용자 문의', 10), ('오류 처리', 20), ('기능 개선', 30), ('업무 요청', 40), ('기타', 90);

-- ---------------------------------------------------------------------
-- tasks: 업무
-- ---------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  task_year    smallint not null,
  task_seq     integer not null,
  task_no      text generated always as
                 ('OMS-' || task_year::text || '-' || lpad(task_seq::text, 4, '0')) stored,
  category_id  smallint not null references public.categories (id) on delete restrict,
  title        text not null,
  content      text not null,
  requester    text,
  status       text not null default 'received',
  priority     text not null default 'normal',
  assignee_id  uuid references public.profiles (id) on delete restrict,
  due_date     date,
  resolution   text,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete restrict,
  reopen_count integer not null default 0,
  version      integer not null default 1,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_year_seq_key unique (task_year, task_seq),
  constraint tasks_task_no_key unique (task_no),
  constraint tasks_year_range check (task_year between 2000 and 2999),
  constraint tasks_seq_range check (task_seq between 1 and 9999),
  constraint tasks_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint tasks_content_len check (char_length(btrim(content)) between 1 and 20000),
  constraint tasks_requester_len check (requester is null or char_length(requester) <= 100),
  constraint tasks_resolution_len check (resolution is null or char_length(resolution) <= 20000),
  constraint tasks_status_check check (status in ('received', 'in_progress', 'on_hold', 'done')),
  constraint tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint tasks_reopen_count_check check (reopen_count >= 0),
  constraint tasks_version_check check (version >= 1),
  -- 완료 상태 ⇔ 완료일시·완료자 존재
  constraint tasks_done_consistency check (
    (status = 'done' and completed_at is not null and completed_by is not null)
    or (status <> 'done' and completed_at is null and completed_by is null)
  ),
  -- 완료 상태에는 최종 처리 결과 필수
  constraint tasks_done_resolution check (
    status <> 'done' or (resolution is not null and char_length(btrim(resolution)) > 0)
  )
);

create index tasks_status_created_idx on public.tasks (status, created_at desc);
create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_category_idx on public.tasks (category_id);
create index tasks_priority_idx on public.tasks (priority);
create index tasks_created_idx on public.tasks (created_at desc);
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);
create index tasks_content_trgm_idx on public.tasks using gin (content extensions.gin_trgm_ops);
create index tasks_resolution_trgm_idx on public.tasks using gin (resolution extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- task_logs: 시스템 자동 기록 (append-only)
-- ---------------------------------------------------------------------
create table public.task_logs (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references public.tasks (id) on delete restrict,
  action     text not null,
  from_value text,
  to_value   text,
  detail     jsonb,
  actor_id   uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint task_logs_action_check check (
    action in ('created', 'status_changed', 'assignee_changed', 'priority_changed', 'edited')
  ),
  constraint task_logs_status_values check (
    action <> 'status_changed' or (
      from_value in ('received', 'in_progress', 'on_hold', 'done')
      and to_value in ('received', 'in_progress', 'on_hold', 'done')
      and from_value <> to_value
    )
  )
);

create index task_logs_task_created_idx on public.task_logs (task_id, created_at);

-- ---------------------------------------------------------------------
-- task_comments: 사용자 처리 이력 (append-only)
-- ---------------------------------------------------------------------
create table public.task_comments (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references public.tasks (id) on delete restrict,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  body       text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint task_comments_body_len check (char_length(btrim(body)) between 1 and 10000),
  constraint task_comments_id_task_key unique (id, task_id)
);

create index task_comments_task_created_idx on public.task_comments (task_id, created_at);
create index task_comments_body_trgm_idx on public.task_comments using gin (body extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- attachments: 첨부파일 메타데이터 (실제 파일은 private Storage 버킷)
-- ---------------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete restrict,
  comment_id   bigint,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  uploaded_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  constraint attachments_storage_path_key unique (storage_path),
  -- 첨부가 달린 처리 이력은 반드시 같은 업무의 것이어야 함
  constraint attachments_comment_fk foreign key (comment_id, task_id)
    references public.task_comments (id, task_id) on delete restrict,
  constraint attachments_path_prefix check (starts_with(storage_path, task_id::text || '/')),
  constraint attachments_file_name_len check (char_length(file_name) between 1 and 255),
  constraint attachments_mime_len check (char_length(mime_type) between 1 and 255),
  constraint attachments_size_check check (size_bytes > 0 and size_bytes <= 20971520)
);

create index attachments_task_idx on public.attachments (task_id);
