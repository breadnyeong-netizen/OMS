/**
 * DB 행 타입 (supabase/migrations 기준 수동 정의).
 * Supabase 프로젝트 연결 후 `npx supabase gen types typescript --linked > src/types/database.types.ts` 로 대체 가능.
 */
import type { TaskPriority, TaskStatus } from "@/lib/domain/task";

export type Role = "admin" | "member";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface TaskListRow {
  id: string;
  task_no: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  requester: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  category: { name: string } | null;
  assignee: { display_name: string } | null;
}
