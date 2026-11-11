"use client";

import { useActionState, useEffect, useRef } from "react";

type State = { ok?: boolean; message?: string };

/** 서버 액션 폼 + 결과 안내(성공=초록, 실패=빨강). 성공 시 resetOnSuccess 면 입력값을 비운다. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "처리 중…",
  resetOnSuccess = false,
  className = "flex flex-col gap-3",
  variant = "primary",
  confirmMessage,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  const btn = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary: "border border-slate-300 bg-white hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${btn}`}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state.message && (
          <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
