import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Profile, TaskListRow } from "@/types/db";
import {
  PAGE_SIZE, SORT_OPTIONS, escapeLike, kstDayStart, kstNextDayStart, quoteFilterValue, type TaskFilters,
} from "./filters";

const LIST_COLUMNS =
  "id, task_no, title, status, priority, requester, due_date, created_at, updated_at," +
  " category:categories(name), assignee:profiles!tasks_assignee_id_fkey(display_name)";

export async function listTasks(supabase: SupabaseClient, f: TaskFilters, currentUserId: string) {
  let query = supabase.from("tasks").select(LIST_COLUMNS, { count: "exact" });

  if (f.status) query = query.eq("status", f.status);
  else if (f.open) query = query.neq("status", "done");
  if (f.priority) query = query.eq("priority", f.priority);
  if (f.category) query = query.eq("category_id", f.category);
  if (f.assignee === "none") query = query.is("assignee_id", null);
  else if (f.assignee === "me") query = query.eq("assignee_id", currentUserId);
  else if (f.assignee) query = query.eq("assignee_id", f.assignee);
  if (f.from) query = query.gte("created_at", kstDayStart(f.from));
  if (f.to) query = query.lt("created_at", kstNextDayStart(f.to));
  if (f.q) {
    const v = quoteFilterValue(`%${escapeLike(f.q)}%`);
    query = query.or(`title.ilike.${v},task_no.ilike.${v},requester.ilike.${v}`);
  }

  const sort = SORT_OPTIONS[f.sort];
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });
  if (sort.column !== "created_at") query = query.order("created_at", { ascending: false });

  const fromIdx = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(fromIdx, fromIdx + PAGE_SIZE - 1);
  // 범위를 벗어난 페이지(PGRST103)는 오류가 아니라 빈 결과로 처리
  if (error?.code === "PGRST103") return { rows: [] as TaskListRow[], total: null, error: null };
  return { rows: (data ?? []) as unknown as TaskListRow[], total: count ?? 0, error };
}

export async function listCategories(supabase: SupabaseClient) {
  const { data } = await supabase.from("categories").select("id, name, sort_order, is_active").order("sort_order");
  return (data ?? []) as Category[];
}

export async function listMembers(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, is_active, created_at, updated_at")
    .order("created_at");
  return (data ?? []) as Profile[];
}
