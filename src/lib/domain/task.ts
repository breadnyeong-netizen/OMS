/** 업무 도메인 상수와 순수 규칙. DB CHECK 제약과 값이 반드시 일치해야 한다 (docs/DESIGN.md 2.2). */

export const TASK_STATUSES = ["received", "in_progress", "on_hold", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  received: "접수",
  in_progress: "진행 중",
  on_hold: "보류",
  done: "완료",
};

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급",
};

/** categories 테이블 초기 시드 값 */
export const DEFAULT_CATEGORIES = ["사용자 문의", "오류 처리", "기능 개선", "업무 요청", "기타"] as const;

const TASK_NO_RE = /^OMS-(\d{4})-(\d{4})$/;

export function formatTaskNo(year: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) throw new RangeError("업무 순번은 1~9999 범위여야 합니다.");
  return `OMS-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseTaskNo(taskNo: string): { year: number; seq: number } | null {
  const m = TASK_NO_RE.exec(taskNo);
  if (!m) return null;
  const seq = Number(m[2]);
  return seq >= 1 ? { year: Number(m[1]), seq } : null;
}

export type TransitionCheck = { ok: true; reopen: boolean } | { ok: false; reason: string };

/**
 * 상태 전이 검사 (UI 사전 검증용 — 최종 판정은 DB 트리거).
 * - 같은 상태로의 변경 불가
 * - 완료 처리 시 최종 처리 결과 필수
 * - 완료 → 다른 상태는 '재개'로 취급
 */
export function checkTransition(from: TaskStatus, to: TaskStatus, resolution?: string | null): TransitionCheck {
  if (from === to) return { ok: false, reason: "현재와 같은 상태입니다." };
  if (to === "done" && !resolution?.trim()) return { ok: false, reason: "완료 처리하려면 최종 처리 결과를 입력해야 합니다." };
  return { ok: true, reopen: from === "done" };
}
