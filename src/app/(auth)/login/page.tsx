import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/member";
import { safeNextPath } from "@/lib/auth/redirect";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

const NOTICES = {
  forbidden: { tone: "error", text: "이 계정은 OMS 사용 권한이 없습니다. 관리자에게 문의하세요." },
  loggedOut: { tone: "info", text: "로그아웃되었습니다." },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next) : undefined;
  if (await getCurrentMember()) redirect(next ?? "/dashboard");

  const notice = sp.error === "forbidden" ? NOTICES.forbidden : sp.loggedOut ? NOTICES.loggedOut : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">OMS 로그인</h1>
        <p className="mb-6 text-sm text-slate-500">관리자가 발급한 아이디로 로그인하세요.</p>
        <LoginForm next={next} notice={notice} />
      </div>
    </main>
  );
}
