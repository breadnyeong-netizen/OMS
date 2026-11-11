begin;
select plan(13);

select has_table('public', t, t || ' 테이블 존재')
from unnest(array['profiles','tasks','task_logs','task_comments','attachments','categories']) t;

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and c.relname in ('profiles','tasks','task_logs','task_comments','attachments','categories')),
  6, '6개 테이블 모두 RLS 활성화');

select results_eq(
  'select name from public.categories order by sort_order',
  array['사용자 문의','오류 처리','기능 개선','업무 요청','기타'],
  '업무 유형 기본값 5개');

select col_is_unique('public', 'tasks', array['task_no'], 'task_no UNIQUE');
select col_is_unique('public', 'tasks', array['task_year','task_seq'], '(task_year, task_seq) UNIQUE');
select has_index('public', 'tasks', 'tasks_title_trgm_idx', '제목 검색 인덱스');
select has_index('public', 'task_comments', 'task_comments_body_trgm_idx', '처리 이력 검색 인덱스');
select is((select public from storage.buckets where id = 'attachments'), false, '첨부 버킷 비공개');

select * from finish();
rollback;
