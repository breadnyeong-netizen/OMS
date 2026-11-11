import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain/task";
import { USERNAME_PATTERN } from "@/lib/domain/username";

const schema = readFileSync("supabase/migrations/20261111000100_schema.sql", "utf8");

describe("앱 상수와 DB 제약 일치", () => {
  it("상태 코드", () => {
    expect(schema).toContain(`status in (${TASK_STATUSES.map((s) => `'${s}'`).join(", ")})`);
  });
  it("우선순위 코드", () => {
    expect(schema).toContain(`priority in (${TASK_PRIORITIES.map((s) => `'${s}'`).join(", ")})`);
  });
  it("아이디 규칙", () => {
    expect(schema).toContain(`username ~ '${USERNAME_PATTERN.source}'`);
  });
});
