"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidUsername, usernameToEmail } from "@/lib/domain/username";
import { safeNextPath } from "@/lib/auth/redirect";

export type LoginState = { error?: string; username?: string };

const INVALID = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!username.trim() || !password) return { error: "아이디와 비밀번호를 입력하세요.", username };
  // 형식이 틀린 아이디도 '존재하지 않음'과 같은 메시지로 응답 (계정 존재 여부 노출 방지)
  if (!isValidUsername(username)) return { error: INVALID, username };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error || !data.user) {
    const tooMany = error?.status === 429;
    return { error: tooMany ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요." : INVALID, username };
  }

  // 인증은 됐지만 초대된(활성) 사용자가 아니면 즉시 로그아웃
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle<{ is_active: boolean }>();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "이 계정은 OMS 사용 권한이 없습니다. 관리자에게 문의하세요.", username };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?loggedOut=1");
}
