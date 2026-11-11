import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * service role 클라이언트 — RLS를 우회한다.
 * 사용처는 사용자 계정 생성(src/lib/users/create.ts)으로 한정하며, 호출 전 반드시 requireAdmin() 으로 관리자 여부를 확인할 것.
 */
export function createAdminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
