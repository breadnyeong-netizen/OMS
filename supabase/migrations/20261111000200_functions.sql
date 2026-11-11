-- =====================================================================
-- OMS 0002: 함수 · 트리거
--   - 회원 판정 헬퍼 (RLS에서 사용)
--   - 활성 사용자 최대 2명
--   - 업무번호 발급 (연도별 직렬화)
--   - 상태 변경 이력 · 완료일시 · 재개 처리 · 낙관적 잠금
--   - 처리 이력 append-only
-- 모든 SECURITY DEFINER 함수는 search_path = '' 로 고정하고 객체를 스키마로 한정한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 헬퍼
-- ---------------------------------------------------------------------
create function private.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  );
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$$;

-- 현재 요청자의 uid. 사용자 컨텍스트 없이(service role 등) 업무 데이터를 바꾸는 것을 막는다.
create function private.require_actor()
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '요청한 사용자를 확인할 수 없습니다.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: 활성 사용자 최대 2명, 마지막 관리자 보호
-- ---------------------------------------------------------------------
create function private.profiles_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_active int;
begin
  -- 동시 초대·활성화 요청을 직렬화한 뒤 개수를 센다 (READ COMMITTED: 잠금 후 문장은 최신 커밋을 본다)
  perform pg_advisory_xact_lock(hashtext('oms.profiles.limit'));

  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    select count(*) into v_active from public.profiles p where p.is_active and p.id <> new.id;
    if v_active >= 2 then
      raise exception '활성 사용자는 최대 2명까지 허용됩니다.' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.username <> old.username or new.created_at <> old.created_at then
      raise exception '아이디와 생성일시는 변경할 수 없습니다.' using errcode = '42501';
    end if;
    if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active)
       and not exists (
         select 1 from public.profiles p
         where p.role = 'admin' and p.is_active and p.id <> old.id
       ) then
      raise exception '마지막 관리자는 비활성화하거나 권한을 변경할 수 없습니다.' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function private.profiles_guard();

-- ---------------------------------------------------------------------
-- tasks INSERT: 업무번호 발급 + 시스템 컬럼 강제
-- ---------------------------------------------------------------------
create function private.tasks_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := private.require_actor();
begin
  if new.status = 'done' then
    raise exception '신규 업무는 완료 상태로 등록할 수 없습니다.' using errcode = '23514';
  end if;

  new.id           := coalesce(new.id, gen_random_uuid());
  new.created_by   := v_actor;
  new.created_at   := now();
  new.updated_at   := now();
  new.completed_at := null;
  new.completed_by := null;
  new.resolution   := null;
  new.reopen_count := 0;
  new.version      := 1;
  new.task_year    := extract(year from (now() at time zone 'Asia/Seoul'))::smallint;

  -- 같은 연도의 발급을 트랜잭션 단위로 직렬화. UNIQUE(task_year, task_seq)가 최종 방어선.
  perform pg_advisory_xact_lock(hashtext('oms.task_no'), new.task_year);
  select coalesce(max(t.task_seq), 0) + 1 into new.task_seq
  from public.tasks t where t.task_year = new.task_year;

  if new.task_seq > 9999 then
    raise exception '% 년 업무번호가 모두 소진되었습니다.', new.task_year using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function private.tasks_before_insert();

create function private.tasks_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.task_logs (task_id, action, to_value, actor_id)
  values (new.id, 'created', new.status, new.created_by);
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

-- ---------------------------------------------------------------------
-- tasks UPDATE: 보호 컬럼, 낙관적 잠금, 완료/재개 처리
-- ---------------------------------------------------------------------
create function private.tasks_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := private.require_actor();
begin
  if new.id <> old.id or new.task_year <> old.task_year or new.task_seq <> old.task_seq
     or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception '업무번호·등록자·등록일시는 변경할 수 없습니다.' using errcode = '42501';
  end if;

  -- 낙관적 잠금: 클라이언트는 읽었던 version 을 그대로 보내야 한다.
  -- 동시에 두 요청이 오면 뒤 요청은 이미 증가한 version 과 비교되어 거부된다.
  if new.version <> old.version then
    raise exception '다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요.'
      using errcode = '40001';
  end if;
  new.version      := old.version + 1;
  new.updated_at   := now();
  new.reopen_count := old.reopen_count;

  if new.status is distinct from old.status then
    if new.status = 'done' then
      -- 완료: 완료일시·완료자는 서버가 기록
      new.completed_at := now();
      new.completed_by := v_actor;
    elsif old.status = 'done' then
      -- 재개: 직전 결과는 task_logs.detail 에 보존(AFTER 트리거)하고 업무에서는 비운다
      new.completed_at := null;
      new.completed_by := null;
      new.resolution   := null;
      new.reopen_count := old.reopen_count + 1;
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  else
    new.completed_at := old.completed_at;
    new.completed_by := old.completed_by;
  end if;

  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function private.tasks_before_update();

create function private.tasks_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  uuid := private.require_actor();
  v_edited jsonb := '{}'::jsonb;
begin
  if new.status is distinct from old.status then
    insert into public.task_logs (task_id, action, from_value, to_value, detail, actor_id)
    values (
      new.id, 'status_changed', old.status, new.status,
      case
        when new.status = 'done' then
          jsonb_build_object('resolution', new.resolution)
        when old.status = 'done' then
          jsonb_build_object(
            'reopened', true,
            'previous_resolution', old.resolution,
            'previous_completed_at', old.completed_at,
            'previous_completed_by', old.completed_by
          )
      end,
      v_actor
    );
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_logs (task_id, action, from_value, to_value, actor_id)
    values (new.id, 'assignee_changed', old.assignee_id::text, new.assignee_id::text, v_actor);
  end if;

  if new.priority is distinct from old.priority then
    insert into public.task_logs (task_id, action, from_value, to_value, actor_id)
    values (new.id, 'priority_changed', old.priority, new.priority, v_actor);
  end if;

  -- 일반 항목 수정: 짧은 항목은 전/후 값을, 긴 본문은 변경 사실만 기록
  if new.title is distinct from old.title then
    v_edited := v_edited || jsonb_build_object('title', jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.category_id is distinct from old.category_id then
    v_edited := v_edited || jsonb_build_object('category_id', jsonb_build_object('from', old.category_id, 'to', new.category_id));
  end if;
  if new.requester is distinct from old.requester then
    v_edited := v_edited || jsonb_build_object('requester', jsonb_build_object('from', old.requester, 'to', new.requester));
  end if;
  if new.due_date is distinct from old.due_date then
    v_edited := v_edited || jsonb_build_object('due_date', jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.content is distinct from old.content then
    v_edited := v_edited || jsonb_build_object('content', jsonb_build_object('changed', true));
  end if;
  -- 완료 상태에서 처리 결과만 고친 경우 (완료/재개 시점의 변경은 status_changed 에 기록됨)
  if new.status = old.status and new.resolution is distinct from old.resolution then
    v_edited := v_edited || jsonb_build_object('resolution', jsonb_build_object('from', old.resolution, 'to', new.resolution));
  end if;

  if v_edited <> '{}'::jsonb then
    insert into public.task_logs (task_id, action, detail, actor_id)
    values (new.id, 'edited', v_edited, v_actor);
  end if;

  return null;
end;
$$;

create trigger tasks_after_update
  after update on public.tasks
  for each row execute function private.tasks_after_update();

-- ---------------------------------------------------------------------
-- 처리 이력 · 업무 삭제 방지 (service role 포함, 마이그레이션으로만 해제)
-- ---------------------------------------------------------------------
create function private.forbid_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception '%', tg_argv[0] using errcode = '42501';
end;
$$;

create trigger task_logs_append_only
  before update or delete on public.task_logs
  for each row execute function private.forbid_change('처리 기록은 수정하거나 삭제할 수 없습니다.');

create trigger task_comments_append_only
  before update or delete on public.task_comments
  for each row execute function private.forbid_change('처리 이력은 수정하거나 삭제할 수 없습니다.');

create trigger tasks_no_delete
  before delete on public.tasks
  for each row execute function private.forbid_change('업무 삭제는 비활성화되어 있습니다.');

create trigger task_logs_no_truncate
  before truncate on public.task_logs
  for each statement execute function private.forbid_change('처리 기록은 삭제할 수 없습니다.');

create trigger task_comments_no_truncate
  before truncate on public.task_comments
  for each statement execute function private.forbid_change('처리 이력은 삭제할 수 없습니다.');

-- ---------------------------------------------------------------------
-- 관리자 RPC: 사용자 활성/비활성 (계정 생성은 서버 API + service role)
-- ---------------------------------------------------------------------
create function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and not p_active then
    raise exception '자기 자신은 비활성화할 수 없습니다.' using errcode = 'P0001';
  end if;
  update public.profiles set is_active = p_active where id = p_user_id;
  if not found then
    raise exception '사용자를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
end;
$$;
