/** Supabase/PostgREST 오류를 사용자에게 보여줄 한국어 메시지로 변환한다. */
export interface DbErrorLike {
  code?: string;
  message?: string;
}

const HANGUL = /[가-힣]/;

export function toUserMessage(error: DbErrorLike | null | undefined, fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요."): string {
  if (!error) return fallback;
  switch (error.code) {
    case "40001":
      return "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요.";
    case "42501":
      // DB 트리거가 던진 한국어 메시지는 그대로 보여준다
      return error.message && HANGUL.test(error.message) ? error.message : "이 작업을 할 권한이 없습니다.";
    case "23505":
      return "이미 존재하는 값입니다.";
    case "23503":
      return "참조하는 항목이 존재하지 않습니다.";
    case "23514":
    case "22001":
      return error.message && HANGUL.test(error.message) ? error.message : "입력 값이 허용 범위를 벗어났습니다.";
    case "P0001":
    case "P0002":
      return error.message || fallback;
    default:
      return fallback;
  }
}
