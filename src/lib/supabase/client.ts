import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** 클라이언트 컴포넌트용. anon key + 사용자 세션으로만 동작하며 모든 권한은 RLS가 판정한다. */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
