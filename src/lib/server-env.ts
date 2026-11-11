import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

/** 서버 전용 비밀 환경변수. `server-only` 덕분에 클라이언트 컴포넌트에서 import 하면 빌드가 실패한다. */
export function serverEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error("서버 전용 환경변수 SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  }
  return parsed.data;
}
