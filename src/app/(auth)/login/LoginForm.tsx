"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/lib/auth/actions";

export function LoginForm({ next, notice }: { next?: string; notice?: { tone: "error" | "info"; text: string } }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const message = state.error ? { tone: "error" as const, text: state.error } : notice;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-sm ${
            message.tone === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
          }`}
        >
          {message.text}
        </p>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        아이디
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username}
          required
          className="rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-slate-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-slate-500 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
