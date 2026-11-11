import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("관리자 비밀키 노출 방지", () => {
  const files = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));

  it("NEXT_PUBLIC_ 접두어로 service role 키를 참조하지 않는다", () => {
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/NEXT_PUBLIC_\w*SERVICE/);
  });

  it("SUPABASE_SERVICE_ROLE_KEY 는 server-only 파일에서만 읽는다", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (src.includes("SUPABASE_SERVICE_ROLE_KEY")) expect(src, f).toMatch(/import "server-only"/);
    }
  });

  it("'use client' 파일은 admin 클라이언트를 import 하지 않는다", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (/^["']use client["']/m.test(src)) expect(src, f).not.toMatch(/supabase\/admin|server-env/);
    }
  });
});
