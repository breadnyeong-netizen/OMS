import { describe, expect, it } from "vitest";
import { createUserSchema } from "@/lib/users/schema";

describe("사용자 생성 입력 검증", () => {
  const base = { username: "Member01", displayName: " 가상사용자 ", password: "longenough1", role: "member" };
  it("아이디 정규화·이름 trim", () => {
    expect(createUserSchema.parse(base)).toEqual({ username: "member01", displayName: "가상사용자", password: "longenough1", role: "member" });
  });
  it("짧은 비밀번호·잘못된 권한·잘못된 아이디 거부", () => {
    expect(createUserSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, role: "owner" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, username: "a@b.com" }).success).toBe(false);
  });
});
