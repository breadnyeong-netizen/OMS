/** 로그인 후 이동할 경로. 외부 URL·프로토콜 상대 경로(//evil.com)로의 오픈 리다이렉트를 막는다. */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/login")) return fallback;
  return next;
}
