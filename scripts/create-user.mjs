#!/usr/bin/env node
// 첫 관리자(또는 사용자) 계정 생성. 웹 화면에 관리자가 아직 없을 때 한 번 사용한다.
// 사용: node --env-file=.env.local scripts/create-user.mjs <아이디> <표시이름> [admin|member]
// 초기 비밀번호는 무작위로 생성해 화면에 한 번만 출력한다. 첫 로그인 후 '환경 설정'에서 바꾸세요.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{2,19}$/; // src/lib/domain/username.ts 와 동일
const LOGIN_EMAIL_DOMAIN = "oms.local";

const [rawUsername, displayName, role = "admin"] = process.argv.slice(2);
const username = (rawUsername ?? "").trim().toLowerCase();

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!username || !displayName) fail("사용법: node --env-file=.env.local scripts/create-user.mjs <아이디> <표시이름> [admin|member]");
if (!USERNAME_PATTERN.test(username)) fail("아이디는 3~20자의 영문 소문자·숫자·_ . - 이며 영문 소문자나 숫자로 시작해야 합니다.");
if (!["admin", "member"].includes(role)) fail("권한은 admin 또는 member 입니다.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail(".env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const password = randomBytes(12).toString("base64url");

const { data, error } = await admin.auth.admin.createUser({
  email: `${username}@${LOGIN_EMAIL_DOMAIN}`,
  password,
  email_confirm: true,
  app_metadata: { username },
});
if (error || !data.user) fail(`계정 생성 실패: ${error?.message ?? "알 수 없는 오류"}`);

const { error: profileError } = await admin
  .from("profiles")
  .insert({ id: data.user.id, username, display_name: displayName, role });
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  fail(`사용자 정보 생성 실패(계정은 되돌렸습니다): ${profileError.message}`);
}

console.log(`✓ 계정을 만들었습니다.
  아이디        : ${username}
  표시 이름     : ${displayName}
  권한          : ${role === "admin" ? "관리자" : "사용자"}
  초기 비밀번호 : ${password}
  (이 비밀번호는 다시 표시되지 않습니다. 첫 로그인 후 '환경 설정'에서 변경하세요.)`);
