import { describe, expect, it } from "vitest";
import { isValidUsername, usernameToEmail } from "@/lib/domain/username";

describe("아이디 로그인", () => {
  it("아이디를 내부 이메일로 변환 (대소문자·공백 정규화)", () => {
    expect(usernameToEmail("  Admin01 ")).toBe("admin01@oms.local");
  });
  it("DB 제약과 같은 규칙으로 검증", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(21))).toBe(false);
    expect(isValidUsername("_admin")).toBe(false);
    expect(isValidUsername("user@x")).toBe(false);
    expect(isValidUsername("홍길동")).toBe(false);
    expect(isValidUsername("kim.dev-01")).toBe(true);
  });
  it("잘못된 아이디는 변환을 거부 (임의 이메일 주입 방지)", () => {
    expect(() => usernameToEmail("evil@other.com")).toThrow();
  });
});
