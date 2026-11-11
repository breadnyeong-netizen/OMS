import { signOut } from "@/lib/auth/actions";
import type { Role } from "@/types/db";

export function Topbar({ displayName, username, role }: { displayName: string; username: string; role: Role }) {
  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 pl-20 md:pl-6">
      <span className="truncate text-sm text-slate-700">
        <span className="font-semibold">{displayName}</span>
        <span className="ml-1 text-slate-400">({username})</span>
        {role === "admin" && (
          <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">관리자</span>
        )}
      </span>
      <form action={signOut}>
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">
          로그아웃
        </button>
      </form>
    </header>
  );
}
