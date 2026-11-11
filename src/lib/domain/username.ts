/**
 * 아이디 로그인.
 * Supabase Auth 는 이메일(또는 전화번호) 기반이므로, 아이디를 고정 도메인의 내부 이메일로 변환해 사용한다.
 * 이 이메일로는 메일이 발송되지 않는다 (계정은 관리자가 비밀번호와 함께 직접 생성).
 * 규칙은 DB 제약 profiles_username_format 과 동일해야 한다.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{2,19}$/;
export const LOGIN_EMAIL_DOMAIN = "oms.local";

export const USERNAME_RULE_MESSAGE =
  "아이디는 3~20자의 영문 소문자·숫자·밑줄(_)·점(.)·하이픈(-)이며 영문 소문자나 숫자로 시작해야 합니다.";

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(input));
}

export function usernameToEmail(input: string): string {
  const username = normalizeUsername(input);
  if (!USERNAME_PATTERN.test(username)) throw new Error(USERNAME_RULE_MESSAGE);
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}
