import Link from "next/link";
import { PRIORITY_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain/task";
import { SORT_OPTIONS, type TaskFilters } from "@/lib/tasks/filters";
import type { Category, Profile } from "@/types/db";

const field = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

/** GET 폼: 필터가 URL 에 남아 새로고침·공유·뒤로가기에도 유지된다. JS 없이도 동작. */
export function TaskFilterForm({ f, categories, members }: { f: TaskFilters; categories: Category[]; members: Profile[] }) {
  const statusValue = f.open ? "open" : (f.status ?? "");
  const hasAdvanced = Boolean(f.category || f.priority || f.assignee || f.from || f.to || f.sort !== "created_desc");
  return (
    <form method="get" className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4 xl:grid-cols-8">
      <label className="col-span-2 flex flex-col gap-1 text-xs text-slate-500">
        키워드
        <input name="q" defaultValue={f.q} placeholder="제목·업무번호·요청자" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        상태
        <select name="status" defaultValue={statusValue} className={field}>
          <option value="">전체</option>
          <option value="open">미완료 전체</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>
      {/* 모바일: 상세 필터 접기 (CSS 전용). 데스크톱에서는 항상 표시 */}
      <input id="more-filters" type="checkbox" className="peer sr-only" defaultChecked={hasAdvanced} />
      <label
        htmlFor="more-filters"
        className="col-span-2 cursor-pointer select-none text-sm text-slate-600 underline underline-offset-2 peer-focus-visible:ring-2 md:hidden"
      >
        상세 필터 {hasAdvanced ? "(적용 중)" : "열기/닫기"}
      </label>
      <div className="hidden peer-checked:contents md:contents">
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        유형
        <select name="category" defaultValue={f.category ?? ""} className={field}>
          <option value="">전체</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (미사용)"}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        우선순위
        <select name="priority" defaultValue={f.priority ?? ""} className={field}>
          <option value="">전체</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        담당자
        <select name="assignee" defaultValue={f.assignee ?? ""} className={field}>
          <option value="">전체</option>
          <option value="me">내 업무</option>
          <option value="none">미지정</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        등록일 시작
        <input type="date" name="from" defaultValue={f.from} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        등록일 끝
        <input type="date" name="to" defaultValue={f.to} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">
        정렬
        <select name="sort" defaultValue={f.sort} className={field}>
          {Object.entries(SORT_OPTIONS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </label>
      </div>
      <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-7 xl:justify-end">
        <Link href="/tasks" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">초기화</Link>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">
          검색
        </button>
      </div>
    </form>
  );
}
