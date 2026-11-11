import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/domain/username";
import { toUserMessage } from "@/lib/errors";
import type { CreateUserInput } from "./schema";

export type CreateUserResult = { ok: true; userId: string } | { ok: false; error: string };

/**
 * 계정 생성: auth 사용자 생성 → profiles 생성.
 * profiles 생성이 실패하면(활성 2명 초과, 아이디 중복 등) 방금 만든 auth 사용자를 삭제해 고아 계정을 남기지 않는다.
 * 호출 전에 반드시 요청자가 관리자인지 확인할 것 (service role 은 RLS 를 우회한다).
 */
export async function createUserAccount(input: CreateUserInput): Promise<CreateUserResult> {
  const admin = createAdminClient();

  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true);
  if ((count ?? 0) >= 2) return { ok: false, error: "활성 사용자는 최대 2명까지 허용됩니다." };

  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(input.username),
    password: input.password,
    email_confirm: true,
    app_metadata: { username: input.username },
  });
  if (error || !data.user) {
    const exists = error?.code === "email_exists" || error?.status === 422;
    return { ok: false, error: exists ? "이미 사용 중인 아이디입니다." : "계정을 만들지 못했습니다. 잠시 후 다시 시도하세요." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    username: input.username,
    display_name: input.displayName,
    role: input.role,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    const msg = profileError.code === "23505" ? "이미 사용 중인 아이디입니다." : toUserMessage(profileError);
    return { ok: false, error: msg };
  }
  return { ok: true, userId: data.user.id };
}
