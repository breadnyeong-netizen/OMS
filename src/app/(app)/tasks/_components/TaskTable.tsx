import Link from "next/link";
import { PriorityText, StatusBadge } from "@/components/ui/Badge";
import { formatDate, isOverdue } from "@/lib/format";
import type { TaskListRow } from "@/types/db";

function Due({ row }: { row: TaskListRow }) {
  if (!row.due_date) return <span className="text-slate-400">-</span>;
  const overdue = row.status !== "done" && isOverdue(row.due_date);
  return <span className={overdue ? "font-semibold text-red-600" : ""}>{row.due_date}{overdue && " (지연)"}</span>;
}

export function TaskTable({ rows }: { rows: TaskListRow[] }) {
  return (
    <>
      {/* 데스크톱: 표 */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">업무번호</th>
              <th scope="col" className="px-3 py-2 font-medium">유형</th>
              <th scope="col" className="px-3 py-2 font-medium">제목</th>
              <th scope="col" className="px-3 py-2 font-medium">상태</th>
              <th scope="col" className="px-3 py-2 font-medium">우선순위</th>
              <th scope="col" className="px-3 py-2 font-medium">담당자</th>
              <th scope="col" className="px-3 py-2 font-medium">등록일</th>
              <th scope="col" className="px-3 py-2 font-medium">기한</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  <Link href={`/tasks/${r.task_no}`} className="text-slate-600 hover:underline">{r.task_no}</Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.category?.name}</td>
                <td className="max-w-md px-3 py-2">
                  <Link href={`/tasks/${r.task_no}`} className="line-clamp-1 font-medium hover:underline">{r.title}</Link>
                  {r.requester && <span className="text-xs text-slate-400">요청: {r.requester}</span>}
                </td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2"><PriorityText priority={r.priority} /></td>
                <td className="whitespace-nowrap px-3 py-2">{r.assignee?.display_name ?? <span className="text-slate-400">미지정</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(r.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2"><Due row={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/tasks/${r.task_no}`} className="block rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{r.task_no}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="font-medium">{r.title}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                <span>{r.category?.name}</span>
                <PriorityText priority={r.priority} />
                <span>{r.assignee?.display_name ?? "미지정"}</span>
                <span>{formatDate(r.created_at)}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
