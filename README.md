# OMS — 2인용 통합 업무 관리 시스템

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL / Auth / Storage) · Vercel

설계: [docs/DESIGN.md](docs/DESIGN.md) — 폴더 구조, DB 설계, 화면 명세, 구현 순서.
모든 개발·테스트 데이터는 가상 데이터만 사용한다.

## 진행 현황

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 프로젝트 구조 · 설계 | ✅ |
| 2 | SQL 마이그레이션 · DB 권한/정합성 테스트 | ✅ |
| 3 | 로그인(아이디) · 업무 목록 | 다음 |

## 실행 방법

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

### 환경변수
| 이름 | 공개 여부 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 | anon key (RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | 관리자 계정 생성에만 사용. `NEXT_PUBLIC_` 금지 |

## 데이터베이스 (2단계)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20261111000100_schema.sql` | 6개 테이블, PK/FK/CHECK/UNIQUE, 인덱스, 업무 유형 기본값 |
| `supabase/migrations/20261111000200_functions.sql` | 업무번호 발급, 상태 이력·완료일시·재개, 낙관적 잠금, 2명 제한, append-only |
| `supabase/migrations/20261111000300_rls.sql` | 컬럼 단위 권한, RLS 정책 |
| `supabase/migrations/20261111000400_storage.sql` | 비공개 첨부 버킷과 정책 |

### Supabase 프로젝트에 적용

**방법 1 — Supabase CLI (권장)**
```bash
npx supabase login
```
```bash
npx supabase link --project-ref <프로젝트 ref>
```
```bash
npx supabase db push
```

**방법 2 — 대시보드**: SQL Editor에서 `supabase/migrations/` 파일을 번호 순서대로 실행.

적용 후 대시보드에서 확인할 것:
- Authentication → Sign In / Providers → **Allow new users to sign up 끄기**
- Storage → `attachments` 버킷이 **Private** 인지

### DB 테스트

```bash
npm run db:test
```
로컬 PostgreSQL 16 + pgTAP 필요 (`PGHOST`, `PGPORT`, `PGUSER` 환경변수로 접속). `scripts/db/supabase-shim.sql`이 Supabase의 auth/storage 스키마를 흉내 낸다.
Docker가 있으면 `npx supabase start && npx supabase test db` 로 실제 Supabase 스택에서도 같은 테스트(`supabase/tests/*.test.sql`)를 실행할 수 있다.

- pgTAP 73개: 테이블·RLS 활성화, 비로그인/비회원 차단, 보호 컬럼, 처리 이력 수정·삭제 불가, 업무번호 형식, 상태 이력, 완료·재개, 낙관적 잠금, 2명 제한, 비공개 첨부
- 동시성 7개: 동시 초대 2건 → 1건만 성공, 20개 세션 동시 등록 100건 → 번호 중복·누락 없음, 같은 version 동시 수정 → 1건만 반영

### 앱 검사
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
