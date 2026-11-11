import Link from "next/link";
import { toSearchParams, type TaskFilters } from "@/lib/tasks/filters";

export function Pagination({ f, totalPages }: { f: TaskFilters; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (page: number) => {
    const qs = toSearchParams({ ...f, page }).toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };
  const start = Math.max(1, Math.min(f.page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  const btn = "min-w-9 rounded-md border px-2 py-1 text-center text-sm";

  return (
    <nav aria-label="페이지" className="mt-4 flex flex-wrap items-center justify-center gap-1">
      {f.page > 1 && <Link className={`${btn} border-slate-300 bg-white`} href={href(f.page - 1)}>이전</Link>}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === f.page ? "page" : undefined}
          className={`${btn} ${p === f.page ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
        >
          {p}
        </Link>
      ))}
      {f.page < totalPages && <Link className={`${btn} border-slate-300 bg-white`} href={href(f.page + 1)}>다음</Link>}
    </nav>
  );
}
