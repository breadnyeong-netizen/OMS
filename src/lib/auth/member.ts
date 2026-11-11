import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/db";

export type Member = { userId: string; profile: Profile };

/**
 * 현재 요청의 로그인 사용자와 활성 profile. 요청당 1회만 조회(cache).
 * profile 조회도 RLS 를 거치므로, 비회원은 자기 profile 조차 보지 못해 null 이 된다.
 */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile || !profile.is_active) return null;
  return { userId: user.id, profile };
});

/** 회원이 아니면 로그아웃시키고 로그인 화면으로 보낸다. 페이지·서버 액션 시작부에서 호출. */
export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (member) return member;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.signOut();
    redirect("/login?error=forbidden");
  }
  redirect("/login");
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (member.profile.role !== "admin") redirect("/dashboard");
  return member;
}
