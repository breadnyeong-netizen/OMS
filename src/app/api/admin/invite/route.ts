import { NextResponse } from "next/server";

/** 3단계 구현 예정: admin 여부 검증 → 활성 사용자 2명 미만 확인 → service role로 inviteUserByEmail + profiles 생성 */
export async function POST() {
  return NextResponse.json({ error: "아직 구현되지 않았습니다." }, { status: 501 });
}
