import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("로그인 후 이동 경로", () => {
  it("내부 경로만 허용", () => {
    expect(safeNextPath("/tasks?status=open")).toBe("/tasks?status=open");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/login")).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });
});
