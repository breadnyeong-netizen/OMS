import { NextResponse } from "next/server";

/**
 * 3단계 구현 예정: admin 여부 검증 → 아이디·표시 이름·초기 비밀번호 검증
 * → service role 로 auth.admin.createUser(아이디@oms.local) + profiles 생성
 * (profiles 생성 실패 시, 예: 활성 2명 초과, 방금 만든 auth 사용자를 삭제)
 */
export async function POST() {
  return NextResponse.json({ error: "아직 구현되지 않았습니다." }, { status: 501 });
}
