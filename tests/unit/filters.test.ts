import { describe, expect, it } from "vitest";
import {
  escapeLike, kstDayStart, kstNextDayStart, parseTaskFilters, quoteFilterValue, toSearchParams,
} from "@/lib/tasks/filters";
import { toUserMessage } from "@/lib/errors";

describe("업무 목록 필터 파싱", () => {
  it("기본값", () => {
    expect(parseTaskFilters({})).toEqual({
      q: undefined, status: undefined, open: undefined, priority: undefined, category: undefined,
      assignee: undefined, from: undefined, to: undefined, sort: "created_desc", page: 1,
    });
  });
  it("유효한 값은 받아들인다", () => {
    const f = parseTaskFilters({
      q: "  로그인 오류 ", status: "on_hold", priority: "urgent", category: "2",
      assignee: "me", from: "2026-01-01", to: "2026-12-31", sort: "due_asc", page: "3",
    });
    expect(f).toMatchObject({ q: "로그인 오류", status: "on_hold", priority: "urgent", category: 2, assignee: "me", sort: "due_asc", page: 3 });
  });
  it("잘못된 값은 무시한다", () => {
    const f = parseTaskFilters({ status: "deleted", priority: "x", category: "-1", assignee: "not-uuid", from: "2026/01/01", sort: "drop table", page: "0" });
    expect(f).toMatchObject({ status: undefined, priority: undefined, category: undefined, assignee: undefined, from: undefined, sort: "created_desc", page: 1 });
  });
  it("미완료(open) 필터", () => {
    expect(parseTaskFilters({ status: "open" })).toMatchObject({ status: undefined, open: true });
  });
  it("URL 로 왕복해도 같은 필터", () => {
    const f = parseTaskFilters({ q: "a,b", status: "open", assignee: "none", page: "2", sort: "updated_desc" });
    const back = parseTaskFilters(Object.fromEntries(toSearchParams(f)));
    expect(back).toEqual(f);
  });
});

describe("검색어 이스케이프", () => {
  it("LIKE 와일드카드를 문자로", () => {
    expect(escapeLike("100%_완료\\")).toBe("100\\%\\_완료\\\\");
  });
  it("PostgREST 필터 값은 따옴표로 감싼다", () => {
    expect(quoteFilterValue('a,b)"c')).toBe('"a,b)\\"c"');
  });
});

describe("날짜 범위 (한국 시간)", () => {
  it("하루의 시작과 다음 날 시작", () => {
    expect(kstDayStart("2026-03-01")).toBe("2026-02-28T15:00:00.000Z");
    expect(kstNextDayStart("2026-12-31")).toBe("2026-12-31T15:00:00.000Z");
  });
});

describe("오류 메시지", () => {
  it("코드별 한국어 메시지", () => {
    expect(toUserMessage({ code: "40001" })).toContain("다른 사용자가 먼저 수정");
    expect(toUserMessage({ code: "42501", message: "permission denied for table tasks" })).toBe("이 작업을 할 권한이 없습니다.");
    expect(toUserMessage({ code: "P0001", message: "활성 사용자는 최대 2명까지 허용됩니다." })).toBe("활성 사용자는 최대 2명까지 허용됩니다.");
    expect(toUserMessage({ code: "XX000", message: "internal" })).toContain("요청을 처리하지 못했습니다");
  });
});
