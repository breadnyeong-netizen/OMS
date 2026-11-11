import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/** 브라우저·서버 공통 공개 환경변수. NEXT_PUBLIC_* 는 빌드 시 인라인되므로 직접 참조해야 한다. */
export function publicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Supabase 공개 환경변수가 설정되지 않았습니다. .env.local 을 확인하세요 (.env.example 참고).",
    );
  }
  return parsed.data;
}
