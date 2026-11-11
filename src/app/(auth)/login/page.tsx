export const metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">OMS 로그인</h1>
        <p className="mb-6 text-sm text-slate-500">초대받은 사용자만 이용할 수 있습니다.</p>
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">로그인 폼은 3단계에서 구현됩니다.</p>
      </div>
    </main>
  );
}
