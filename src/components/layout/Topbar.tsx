export function Topbar({ userLabel }: { userLabel: string }) {
  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 pl-20 md:pl-6">
      <span className="truncate text-sm text-slate-600">{userLabel}</span>
      {/* 3단계: 서버 액션으로 signOut */}
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">
          로그아웃
        </button>
      </form>
    </header>
  );
}
