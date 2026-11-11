import { PRIORITY_LABEL, STATUS_LABEL, type TaskPriority, type TaskStatus } from "@/lib/domain/task";

const STATUS_STYLE: Record<TaskStatus, string> = {
  received: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  on_hold: "bg-amber-50 text-amber-800 ring-amber-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "text-slate-500",
  normal: "text-slate-700",
  high: "text-orange-600 font-semibold",
  urgent: "text-red-600 font-bold",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityText({ priority }: { priority: TaskPriority }) {
  return <span className={`whitespace-nowrap text-sm ${PRIORITY_STYLE[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
}
