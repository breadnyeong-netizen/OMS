import { ActionForm } from "@/components/ui/ActionForm";
import { requireMember } from "@/lib/auth/member";
import { USERNAME_RULE_MESSAGE } from "@/lib/domain/username";
import { listCategories, listMembers } from "@/lib/tasks/queries";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_MIN } from "@/lib/users/schema";
import {
  addCategory, changePassword, createUser, setCategoryActive, setUserActive, updateDisplayName,
} from "./actions";

export const metadata = { title: "환경 설정" };

const input = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-normal";
const label = "flex flex-col gap-1 text-sm font-medium";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const { userId, profile } = await requireMember();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();
  const [members, categories] = isAdmin ? await Promise.all([listMembers(supabase), listCategories(supabase)]) : [[], []];
  const activeCount = members.filter((m) => m.is_active).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-bold">환경 설정</h1>

      <Card title="내 정보" desc={`아이디: ${profile.username}`}>
        <ActionForm action={updateDisplayName} submitLabel="저장" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`${label} flex-1`}>
            표시 이름
            <input name="displayName" defaultValue={profile.display_name} maxLength={50} required className={input} />
          </label>
        </ActionForm>
      </Card>

      <Card title="비밀번호 변경" desc={`${PASSWORD_MIN}자 이상. 관리자가 발급한 초기 비밀번호는 첫 로그인 후 바꾸세요.`}>
        <ActionForm action={changePassword} submitLabel="비밀번호 변경" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>현재 비밀번호<input type="password" name="current" autoComplete="current-password" required className={input} /></label>
            <label className={label}>새 비밀번호<input type="password" name="next" autoComplete="new-password" minLength={PASSWORD_MIN} required className={input} /></label>
            <label className={label}>새 비밀번호 확인<input type="password" name="confirm" autoComplete="new-password" required className={input} /></label>
          </div>
        </ActionForm>
      </Card>

      {isAdmin && (
        <>
          <Card title="사용자 관리" desc={`활성 사용자 ${activeCount} / 2명`}>
            <ul className="mb-4 divide-y divide-slate-100 rounded-md border border-slate-200">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{m.display_name}</span>
                    <span className="ml-1 text-slate-400">({m.username})</span>
                    <span className="ml-2 text-xs text-slate-500">{m.role === "admin" ? "관리자" : "사용자"}</span>
                    {!m.is_active && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs">비활성</span>}
                  </span>
                  {m.id !== userId && (
                    <ActionForm
                      action={setUserActive}
                      submitLabel={m.is_active ? "비활성화" : "활성화"}
                      variant={m.is_active ? "danger" : "secondary"}
                      className="flex items-center gap-2"
                      confirmMessage={m.is_active ? `${m.display_name} 사용자를 비활성화할까요? 즉시 접근이 차단됩니다.` : undefined}
                    >
                      <input type="hidden" name="userId" value={m.id} />
                      <input type="hidden" name="active" value={String(!m.is_active)} />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>

            {activeCount < 2 ? (
              <ActionForm action={createUser} submitLabel="사용자 추가" pendingLabel="생성 중…" resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    아이디
                    <input name="username" required autoCapitalize="none" spellCheck={false} className={input} />
                    <span className="text-xs font-normal text-slate-400">{USERNAME_RULE_MESSAGE}</span>
                  </label>
                  <label className={label}>표시 이름<input name="displayName" required maxLength={50} className={input} /></label>
                  <label className={label}>
                    초기 비밀번호
                    <input type="password" name="password" autoComplete="new-password" minLength={PASSWORD_MIN} required className={input} />
                  </label>
                  <label className={label}>
                    권한
                    <select name="role" defaultValue="member" className={input}>
                      <option value="member">사용자</option>
                      <option value="admin">관리자</option>
                    </select>
                  </label>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-slate-500">활성 사용자가 2명이라 더 추가할 수 없습니다. 추가하려면 먼저 한 명을 비활성화하세요.</p>
            )}
          </Card>

          <Card title="업무 유형" desc="사용하지 않는 유형은 미사용으로 바꾸세요. 과거 업무에는 그대로 표시됩니다.">
            <ul className="mb-4 divide-y divide-slate-100 rounded-md border border-slate-200">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className={c.is_active ? "" : "text-slate-400 line-through"}>{c.name}</span>
                  <ActionForm
                    action={setCategoryActive}
                    submitLabel={c.is_active ? "미사용" : "사용"}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={String(!c.is_active)} />
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={addCategory} submitLabel="유형 추가" resetOnSuccess className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className={`${label} flex-1`}>새 유형 이름<input name="name" required maxLength={30} className={input} /></label>
            </ActionForm>
          </Card>
        </>
      )}
    </div>
  );
}
