-- =====================================================================
-- OMS 0004: 첨부파일 Storage (비공개 버킷)
-- 경로 규칙: {task_id}/{uuid}-{원본파일명}
-- 다운로드는 서버에서 짧은 만료의 signed URL 로만 제공한다.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy oms_attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (select private.is_member()));

create policy oms_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (select private.is_member())
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
    )
  );

-- UPDATE / DELETE 정책 없음: 업로드한 파일은 덮어쓰거나 지울 수 없다.
