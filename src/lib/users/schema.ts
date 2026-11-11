import { z } from "zod";
import { USERNAME_PATTERN, USERNAME_RULE_MESSAGE, normalizeUsername } from "@/lib/domain/username";

export const PASSWORD_MIN = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
  .max(72, "비밀번호는 72자 이하여야 합니다.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "표시 이름을 입력하세요.")
  .max(50, "표시 이름은 50자 이하여야 합니다.");

export const createUserSchema = z.object({
  username: z.string().transform(normalizeUsername).pipe(z.string().regex(USERNAME_PATTERN, USERNAME_RULE_MESSAGE)),
  displayName: displayNameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "member"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력 값을 확인하세요.";
}
