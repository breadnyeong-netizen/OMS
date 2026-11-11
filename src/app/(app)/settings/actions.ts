"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireMember } from "@/lib/auth/member";
import { usernameToEmail } from "@/lib/domain/username";
import { toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createUserAccount } from "@/lib/users/create";
import { createUserSchema, displayNameSchema, firstIssue, passwordSchema } from "@/lib/users/schema";

export type FormState = { ok?: boolean; message?: string };

export async function updateDisplayName(_p: FormState, fd: FormData): Promise<FormState> {
  const { userId } = await requireMember();
  const parsed = displayNameSchema.safeParse(fd.get("displayName"));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", userId);
  if (error) return { ok: false, message: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "표시 이름을 저장했습니다." };
}

export async function changePassword(_p: FormState, fd: FormData): Promise<FormState> {
  const { profile } = await requireMember();
  const current = String(fd.get("current") ?? "");
  const next = passwordSchema.safeParse(fd.get("next"));
  if (!next.success) return { ok: false, message: firstIssue(next.error) };
  if (next.data !== fd.get("confirm")) return { ok: false, message: "새 비밀번호 확인이 일치하지 않습니다." };
  if (next.data === current) return { ok: false, message: "현재 비밀번호와 다른 비밀번호를 입력하세요." };

  const supabase = await createClient();
  // 세션 탈취 시 비밀번호 변경을 막기 위해 현재 비밀번호를 다시 확인
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(profile.username),
    password: current,
  });
  if (verifyError) return { ok: false, message: "현재 비밀번호가 올바르지 않습니다." };

  const { error } = await supabase.auth.updateUser({ password: next.data });
  if (error) return { ok: false, message: "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도하세요." };
  return { ok: true, message: "비밀번호를 변경했습니다." };
}

export async function createUser(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse({
    username: fd.get("username"),
    displayName: fd.get("displayName"),
    password: fd.get("password"),
    role: fd.get("role"),
  });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const result = await createUserAccount(parsed.data);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/settings");
  return { ok: true, message: `사용자 '${parsed.data.username}' 계정을 만들었습니다. 초기 비밀번호를 본인에게 전달하세요.` };
}

export async function setUserActive(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = z.string().uuid().safeParse(fd.get("userId"));
  if (!userId.success) return { ok: false, message: "잘못된 요청입니다." };
  const active = fd.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_active", { p_user_id: userId.data, p_active: active });
  if (error) return { ok: false, message: toUserMessage(error) };
  revalidatePath("/settings");
  return { ok: true, message: active ? "사용자를 활성화했습니다." : "사용자를 비활성화했습니다." };
}

const categoryNameSchema = z.string().trim().min(1, "유형 이름을 입력하세요.").max(30, "유형 이름은 30자 이하여야 합니다.");

export async function addCategory(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = categoryNameSchema.safeParse(fd.get("name"));
  if (!name.success) return { ok: false, message: firstIssue(name.error) };

  const supabase = await createClient();
  const { data: last } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("categories").insert({ name: name.data, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) return { ok: false, message: error.code === "23505" ? "이미 있는 유형 이름입니다." : toUserMessage(error) };
  revalidatePath("/settings");
  return { ok: true, message: `업무 유형 '${name.data}'을(를) 추가했습니다.` };
}

export async function setCategoryActive(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "잘못된 요청입니다." };
  const active = fd.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_active: active }).eq("id", id.data);
  if (error) return { ok: false, message: toUserMessage(error) };
  revalidatePath("/settings");
  return { ok: true, message: active ? "유형을 다시 사용합니다." : "유형을 미사용으로 바꿨습니다. 기존 업무에는 그대로 표시됩니다." };
}
