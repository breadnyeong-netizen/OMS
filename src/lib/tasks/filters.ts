import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain/task";

export const PAGE_SIZE = 20;

export const SORT_OPTIONS = {
  created_desc: { label: "최신 등록순", column: "created_at", ascending: false },
  created_asc: { label: "오래된 등록순", column: "created_at", ascending: true },
  due_asc: { label: "기한 임박순", column: "due_date", ascending: true },
  updated_desc: { label: "최근 수정순", column: "updated_at", ascending: false },
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

/** 잘못된 값은 오류 대신 무시한다 (URL 을 손으로 고쳐도 화면이 깨지지 않도록). */
function pick<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const r = schema.safeParse(value);
  return r.success ? r.data : undefined;
}

export interface TaskFilters {
  q?: string;
  status?: (typeof TASK_STATUSES)[number];
  open?: boolean; // 완료 제외
  priority?: (typeof TASK_PRIORITIES)[number];
  category?: number;
  assignee?: string | "none" | "me";
  from?: string;
  to?: string;
  sort: SortKey;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseTaskFilters(raw: RawParams): TaskFilters {
  const q = first(raw.q)?.trim().slice(0, 100);
  const status = first(raw.status);
  const assignee = first(raw.assignee);
  return {
    q: q || undefined,
    status: pick(z.enum(TASK_STATUSES), status),
    open: status === "open" ? true : undefined,
    priority: pick(z.enum(TASK_PRIORITIES), first(raw.priority)),
    category: pick(z.coerce.number().int().positive().max(32767), first(raw.category)),
    assignee: assignee === "none" || assignee === "me" ? assignee : pick(uuid, assignee),
    from: pick(dateStr, first(raw.from)),
    to: pick(dateStr, first(raw.to)),
    sort: pick(z.enum(Object.keys(SORT_OPTIONS) as [SortKey, ...SortKey[]]), first(raw.sort)) ?? "created_desc",
    page: pick(z.coerce.number().int().min(1).max(10000), first(raw.page)) ?? 1,
  };
}

/** 필터를 URL 쿼리로 되돌린다 (기본값은 생략). */
export function toSearchParams(f: Partial<TaskFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.open) p.set("status", "open");
  else if (f.status) p.set("status", f.status);
  if (f.priority) p.set("priority", f.priority);
  if (f.category) p.set("category", String(f.category));
  if (f.assignee) p.set("assignee", f.assignee);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.sort && f.sort !== "created_desc") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

/** ILIKE 패턴의 와일드카드(% _ \)를 문자 그대로 검색하도록 이스케이프 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * PostgREST `or=(...)` 필터 안에 넣을 값. 쉼표·괄호가 필터 문법으로 해석되지 않도록
 * 큰따옴표로 감싸고 내부의 \ 와 " 를 이스케이프한다.
 */
export function quoteFilterValue(input: string): string {
  return `"${input.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** 'YYYY-MM-DD'(한국 시간)의 시작/다음날 시작을 ISO 문자열로 */
export function kstDayStart(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}
export function kstNextDayStart(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
