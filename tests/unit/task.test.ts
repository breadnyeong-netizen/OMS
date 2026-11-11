import { describe, expect, it } from "vitest";
import { checkTransition, formatTaskNo, parseTaskNo, STATUS_LABEL, TASK_STATUSES } from "@/lib/domain/task";

describe("업무번호", () => {
  it("OMS-YYYY-NNNN 형식으로 0을 채운다", () => {
    expect(formatTaskNo(2026, 1)).toBe("OMS-2026-0001");
    expect(formatTaskNo(2026, 9999)).toBe("OMS-2026-9999");
  });
  it("범위를 벗어난 순번은 거부한다", () => {
    expect(() => formatTaskNo(2026, 0)).toThrow();
    expect(() => formatTaskNo(2026, 10000)).toThrow();
  });
  it("파싱은 형식과 순번을 검증한다", () => {
    expect(parseTaskNo("OMS-2026-0042")).toEqual({ year: 2026, seq: 42 });
    expect(parseTaskNo("OMS-2026-0000")).toBeNull();
    expect(parseTaskNo("oms-2026-0001")).toBeNull();
    expect(parseTaskNo("OMS-2026-1")).toBeNull();
  });
});

describe("상태 전이", () => {
  it("모든 상태에 한국어 라벨이 있다", () => {
    TASK_STATUSES.forEach((s) => expect(STATUS_LABEL[s]).toBeTruthy());
  });
  it("같은 상태로는 변경할 수 없다", () => {
    expect(checkTransition("received", "received").ok).toBe(false);
  });
  it("완료에는 처리 결과가 필요하다", () => {
    expect(checkTransition("in_progress", "done", "  ").ok).toBe(false);
    expect(checkTransition("in_progress", "done", "가상 처리 결과")).toEqual({ ok: true, reopen: false });
  });
  it("완료 업무를 다른 상태로 바꾸면 재개로 처리한다", () => {
    expect(checkTransition("done", "in_progress")).toEqual({ ok: true, reopen: true });
  });
});
