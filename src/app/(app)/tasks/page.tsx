import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { requireMember } from "@/lib/auth/member";
import { toUserMessage } from "@/lib/errors";
import { PAGE_SIZE, parseTaskFilters } from "@/lib/tasks/filters";
import { listCategories, listMembers, listTasks } from "@/lib/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "./_components/Pagination";
import { TaskFilterForm } from "./_components/TaskFilterForm";
import { TaskTable } from "./_components/TaskTable";

export const metadata = { title: "업무 목록" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await requireMember();
  const f = parseTaskFilters(await searchParams);
  const supabase = await createClient();

  const [{ rows, total, error }, categories, members] = await Promise.all([
    listTasks(supabase, f, userId),
    listCategories(supabase),
    listMembers(supabase),
  ]);
  const totalPages = total === null ? 0 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">업무 목록</h1>
        <Link href="/tasks/new" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">
          + 신규 업무
        </Link>
      </div>

      <TaskFilterForm f={f} categories={categories} members={members} />

      {error ? (
        <Alert tone="error">업무 목록을 불러오지 못했습니다. {toUserMessage(error)}</Alert>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
            {total === null ? "해당 페이지가 없습니다." : <>총 <strong className="text-slate-800">{total.toLocaleString("ko-KR")}</strong>건</>}
          </p>
          {rows.length > 0 ? (
            <TaskTable rows={rows} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              조건에 맞는 업무가 없습니다.{" "}
              {total === null ? <Link href="/tasks" className="underline">첫 페이지로</Link> : <Link href="/tasks/new" className="underline">새 업무 등록</Link>}
            </div>
          )}
          <Pagination f={f} totalPages={totalPages} />
        </>
      )}
    </section>
  );
}
