import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/supabase/middleware";

describe("공개 경로 판정", () => {
  it("로그인·인증 콜백만 공개", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/tasks")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

import { activeHref } from "@/components/layout/nav";

describe("사이드바 활성 메뉴", () => {
  it("가장 구체적인 메뉴만 활성화", () => {
    expect(activeHref("/tasks/new")).toBe("/tasks/new");
    expect(activeHref("/tasks/OMS-2026-0001")).toBe("/tasks");
    expect(activeHref("/dashboard")).toBe("/dashboard");
  });
});
