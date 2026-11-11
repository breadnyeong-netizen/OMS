# 2인용 통합 OMS — 설계 문서 (v1.0 확정)

> 상태: **확정 (2026-11-11)**. 2단계 마이그레이션: `supabase/migrations/`, 테스트: `supabase/tests/`, `scripts/db/`.
> 모든 예시·테스트 데이터는 가상 데이터다.

---

## 1. 프로젝트 폴더 구조

```
oms/
├─ docs/
│  └─ DESIGN.md                 # 본 설계 문서
├─ supabase/
│  ├─ migrations/               # (2단계) 0001_schema.sql, 0002_rls.sql, 0003_functions.sql, 0004_storage.sql
│  ├─ tests/                    # (2·7단계) pgTAP RLS/제약조건 테스트 (*.test.sql)
│  └─ seed.sql                  # (2단계) 가상 데이터
├─ src/
│  ├─ middleware.ts             # 세션 갱신 + 미로그인 사용자 /login 리다이렉트
│  ├─ app/
│  │  ├─ layout.tsx             # 루트 레이아웃 (lang="ko")
│  │  ├─ page.tsx               # / → /dashboard 리다이렉트
│  │  ├─ (auth)/login/          # 1. 로그인
│  │  ├─ (app)/layout.tsx       # 사이드바 + 상단바 셸, 회원 여부 서버 검증
│  │  ├─ (app)/dashboard/       # 2. 대시보드
│  │  ├─ (app)/tasks/           # 3. 업무 목록
│  │  ├─ (app)/tasks/new/       # 4. 신규 업무 등록
│  │  ├─ (app)/tasks/[taskNo]/  # 5. 업무 상세 및 처리 이력
│  │  ├─ (app)/search/          # 6. 통합 검색
│  │  ├─ (app)/settings/        # 7. 환경 설정 (프로필·업무유형·사용자 초대)
│  │  └─ api/admin/invite/      # 관리자 초대 (서버 전용, service role 사용)
│  ├─ components/
│  │  ├─ layout/                # Sidebar, Topbar
│  │  └─ ui/                    # Badge, Table, Toast 등 공통 UI
│  ├─ lib/
│  │  ├─ env.ts                 # 환경변수 검증 (공개/서버 전용 분리)
│  │  ├─ domain/                # 상태·우선순위 상수, 상태 전이 규칙 (순수 함수, 단위 테스트 대상)
│  │  └─ supabase/
│  │     ├─ client.ts           # 브라우저용 (anon key)
│  │     ├─ server.ts           # 서버 컴포넌트/액션용 (anon key + 쿠키 세션)
│  │     ├─ admin.ts            # service role — `server-only`, 클라이언트 번들 포함 불가
│  │     └─ middleware.ts       # 미들웨어 세션 갱신 헬퍼
│  └─ types/                    # (2단계) supabase gen types 결과 database.types.ts
├─ tests/
│  ├─ unit/                     # Vitest 단위 테스트
│  └─ integration/              # (7단계) 실제 Supabase(로컬/스테이징) 대상 API·권한 테스트
├─ .env.example
└─ README.md
```

**원칙**
- 데이터 정합성 규칙(업무번호, 상태 이력, 완료일시)은 **DB 트리거/함수**에서 강제한다. 앱 코드는 이를 우회할 수 없다.
- 클라이언트는 anon key + 사용자 JWT로만 접근하고, 모든 권한은 **RLS**로 판정한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 `src/lib/supabase/admin.ts`(`import "server-only"`)에서만 읽는다. `NEXT_PUBLIC_` 접두어 금지.

---

## 2. 데이터베이스 설계

### 2.1 ER 개요

```
auth.users 1──1 profiles
profiles   1──N tasks (created_by, assignee_id, completed_by)
categories 1──N tasks (category_id)          ← 업무 유형
tasks      1──N task_logs                    ← 시스템 자동 기록 (상태·담당자·우선순위 변경, 완료, 재개)
tasks      1──N task_comments                ← 사용자가 입력하는 처리 이력
tasks      1──N attachments  (comment_id 선택 FK → task_comments)
```

### 2.2 코드 값 (DB에는 영문 코드, 화면에는 한국어 라벨)

| 구분 | 코드 → 라벨 |
|---|---|
| status | `received` 접수 · `in_progress` 진행 중 · `on_hold` 보류 · `done` 완료 |
| priority | `low` 낮음 · `normal` 보통 · `high` 높음 · `urgent` 긴급 |
| role | `admin` 관리자 · `member` 사용자 |
| 업무 유형 | `categories` 테이블 시드: 사용자 문의, 오류 처리, 기능 개선, 업무 요청, 기타 |

업무 유형을 테이블로 둔 이유: 환경 설정 화면에서 이름·정렬·사용 여부를 관리할 수 있고, 과거 업무가 참조하는 유형은 삭제 대신 `is_active=false`로 숨긴다.

### 2.3 테이블 정의

#### profiles
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | **PK**, FK → `auth.users(id)` ON DELETE RESTRICT |
| username | text | NOT NULL, UNIQUE, CHECK `username ~ '^[a-z0-9][a-z0-9_.-]{2,19}$'` (로그인 아이디) |
| display_name | text | NOT NULL, CHECK `char_length(btrim(display_name)) BETWEEN 1 AND 50` |
| role | text | NOT NULL DEFAULT `'member'`, CHECK `role IN ('admin','member')` |
| is_active | boolean | NOT NULL DEFAULT true |
| created_at / updated_at | timestamptz | NOT NULL DEFAULT now() |

- **최대 2명 제한**: BEFORE INSERT/UPDATE 트리거가 advisory lock으로 직렬화한 뒤 활성 사용자 수 ≤ 2를 검사 → 동시 초대 2건이 와도 3번째는 실패. 마지막 관리자는 비활성화·강등 불가.
- **아이디 로그인**: Supabase Auth는 이메일 기반이므로 아이디를 내부 이메일 `{아이디}@oms.local`로 변환한다(메일 발송 없음). 계정은 관리자가 아이디·초기 비밀번호로 직접 생성한다(`auth.admin.createUser`).
- profiles는 **초대 API(service role)만 생성**한다. Supabase 대시보드에서 공개 회원가입을 끈다. 혹시 auth.users에 다른 계정이 생겨도 profile이 없으므로 `is_member()`가 false → 모든 데이터 차단.

#### categories
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | smallint | **PK** GENERATED ALWAYS AS IDENTITY |
| name | text | NOT NULL, **UNIQUE**, CHECK 길이 1–30 |
| sort_order | smallint | NOT NULL DEFAULT 0 |
| is_active | boolean | NOT NULL DEFAULT true |
| created_at | timestamptz | NOT NULL DEFAULT now() |

#### tasks
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | **PK** DEFAULT gen_random_uuid() |
| task_year | smallint | NOT NULL (트리거가 설정) |
| task_seq | integer | NOT NULL, CHECK `task_seq BETWEEN 1 AND 9999` |
| task_no | text | GENERATED ALWAYS AS (`'OMS-' \|\| task_year::text \|\| '-' \|\| lpad(task_seq::text, 4, '0')`) STORED, **UNIQUE** |
| category_id | smallint | NOT NULL, FK → categories(id) ON DELETE RESTRICT |
| title | text | NOT NULL, CHECK 길이 1–200 |
| content | text | NOT NULL, CHECK 길이 1–20000 |
| requester | text | NULL 허용 (요청자 이름/부서, 가상 데이터) , CHECK 길이 ≤ 100 |
| status | text | NOT NULL DEFAULT `'received'`, CHECK IN (4개 코드) |
| priority | text | NOT NULL DEFAULT `'normal'`, CHECK IN (4개 코드) |
| assignee_id | uuid | NULL 허용, FK → profiles(id) |
| due_date | date | NULL 허용 |
| resolution | text | NULL 허용, CHECK 길이 ≤ 20000 |
| completed_at | timestamptz | NULL 허용 |
| completed_by | uuid | NULL 허용, FK → profiles(id) |
| reopen_count | integer | NOT NULL DEFAULT 0, CHECK ≥ 0 |
| version | integer | NOT NULL DEFAULT 1 (낙관적 잠금) |
| created_by | uuid | NOT NULL, FK → profiles(id) |
| created_at / updated_at | timestamptz | NOT NULL DEFAULT now() |

- UNIQUE `(task_year, task_seq)`
- CHECK `chk_done_consistency`:
  `(status = 'done') = (completed_at IS NOT NULL AND completed_by IS NOT NULL)`
- CHECK `chk_done_resolution`: `status <> 'done' OR char_length(btrim(resolution)) > 0`

#### task_logs (자동 기록, append-only)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | bigint | **PK** IDENTITY |
| task_id | uuid | NOT NULL, FK → tasks(id) ON DELETE RESTRICT |
| action | text | NOT NULL, CHECK IN (`created`,`status_changed`,`assignee_changed`,`priority_changed`,`edited`. 완료·재개는 `status_changed`의 `detail`에 처리 결과 / 직전 결과 스냅샷으로 기록) |
| from_value | text | NULL |
| to_value | text | NULL |
| detail | jsonb | NULL (예: 재개 시 직전 처리 결과·완료일시 스냅샷) |
| actor_id | uuid | NOT NULL, FK → profiles(id) |
| created_at | timestamptz | NOT NULL DEFAULT clock_timestamp() |

- CHECK: `action <> 'status_changed' OR (from_value IN (...4개) AND to_value IN (...4개) AND from_value <> to_value)`

#### task_comments (사용자 처리 이력, append-only)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | bigint | **PK** IDENTITY |
| task_id | uuid | NOT NULL, FK → tasks(id) ON DELETE RESTRICT |
| author_id | uuid | NOT NULL, FK → profiles(id), DEFAULT auth.uid() |
| body | text | NOT NULL, CHECK 길이 1–10000 |
| created_at | timestamptz | NOT NULL DEFAULT clock_timestamp() |

#### attachments
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | **PK** DEFAULT gen_random_uuid() |
| task_id | uuid | NOT NULL, FK → tasks(id) ON DELETE RESTRICT |
| comment_id | bigint | NULL, FK → task_comments(id) |
| storage_path | text | NOT NULL, **UNIQUE**, CHECK `storage_path LIKE task_id::text \|\| '/%'` |
| file_name | text | NOT NULL, CHECK 길이 1–255 |
| mime_type | text | NOT NULL |
| size_bytes | bigint | NOT NULL, CHECK `size_bytes > 0 AND size_bytes <= 20971520` (20MB) |
| uploaded_by | uuid | NOT NULL, FK → profiles(id), DEFAULT auth.uid() |
| created_at | timestamptz | NOT NULL DEFAULT now() |

### 2.4 인덱스
| 테이블 | 인덱스 | 용도 |
|---|---|---|
| tasks | `(status, created_at DESC)` | 상태 필터 목록 |
| tasks | `(assignee_id, status)` | "내 업무" |
| tasks | `(category_id)`, `(priority)` | 필터 |
| tasks | `(created_at DESC)` | 기본 정렬 |
| tasks | GIN `gin_trgm_ops` on `title`, `content`, `resolution` | 통합 검색 (부분 일치) |
| task_logs | `(task_id, created_at)` | 상세 타임라인 |
| task_comments | `(task_id, created_at)` + GIN trgm on `body` | 타임라인, 검색 |
| attachments | `(task_id)` | 상세 첨부 목록 |
| profiles | UNIQUE `username` | 로그인 |

> 한국어 검색: PostgreSQL 기본 full-text 사전은 한국어 형태소를 지원하지 않으므로 `pg_trgm` + `ILIKE`를 쓴다. 3글자 미만 검색어는 인덱스를 못 타서 순차 탐색이 되지만, 2인 사용 규모(수천 건)에서는 문제없다.

### 2.5 동시성·정합성 구현

| 규칙 | 구현 |
|---|---|
| **업무번호 발급** | `BEFORE INSERT` 트리거: `pg_advisory_xact_lock(hashtext('oms_task_no'), year)` 획득 → `max(task_seq)+1` 계산. 같은 연도 발급이 트랜잭션 단위로 직렬화되며, `UNIQUE(task_year, task_seq)`가 최종 방어선. 연도는 `Asia/Seoul` 기준. 클라이언트가 보낸 task_year/task_seq 값은 무시(덮어씀). |
| **상태 변경 이력** | `BEFORE UPDATE` 트리거가 OLD/NEW 비교 → `task_logs`에 `status_changed`(이전/변경 상태, `auth.uid()`, `clock_timestamp()`) 기록. 담당자·우선순위 변경도 동일. 트리거는 `SECURITY DEFINER`로 로그를 쓰고, 사용자에게는 task_logs INSERT 권한이 없다. |
| **완료일시** | 같은 트리거에서 `→ done`이면 `completed_at = now()`, `completed_by = auth.uid()` 설정 (클라이언트 값 무시). `done →` 다른 상태(재개)면 직전 `resolution`·`completed_at`을 `task_logs.detail`에 스냅샷 저장 후 `completed_at/by`·`resolution`을 NULL로, `reopen_count + 1`. |
| **잃어버린 갱신 방지** | 앱은 수정 시 읽었던 `version`을 함께 보낸다. 트리거가 현재 값과 다르면 `40001` 오류를 내고, 같으면 +1. 동시에 두 요청이 오면 뒤 요청은 증가한 version과 비교되어 거부 → 화면에 "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요." |
| **보호 컬럼** | 트리거에서 `id, task_year, task_seq, created_by, created_at, completed_at, completed_by, reopen_count, version` 직접 변경을 무시/거부. |
| **append-only** | `task_logs`, `task_comments`: UPDATE/DELETE 정책 없음 + `REVOKE UPDATE, DELETE` + 이를 막는 트리거(service role 포함 차단, 마이그레이션으로만 해제). |
| **업무 삭제 비활성** | tasks에 DELETE 정책 없음 + `REVOKE DELETE`. FK는 모두 `ON DELETE RESTRICT`. |

### 2.6 RLS 정책 요약

공통 헬퍼(모두 `SECURITY DEFINER STABLE`, `search_path = ''`):
- `private.is_member()` → `auth.uid()`의 활성 profile 존재 여부
- `private.is_admin()` → 활성 + role='admin'

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | member | ✕ (service role만) | 본인 `display_name`만 (컬럼 권한) / admin은 `is_active` | ✕ |
| categories | member | admin | admin | ✕ |
| tasks | member | member, `created_by = auth.uid()` | member (허용 컬럼만) | ✕ |
| task_logs | member | ✕ (트리거만) | ✕ | ✕ |
| task_comments | member | member, `author_id = auth.uid()` | ✕ | ✕ |
| attachments | member | member, `uploaded_by = auth.uid()` | ✕ | ✕ |
| storage `attachments` 버킷 (private) | member | member, 경로 첫 폴더가 존재하는 task_id | ✕ | ✕ |

`anon` 롤은 모든 테이블에서 권한 없음. 파일 다운로드는 서버에서 60초짜리 signed URL을 발급한다.

---

## 3. 화면별 기능 명세

| # | 화면 | 경로 | 주요 기능 |
|---|---|---|---|
| 1 | 로그인 | `/login` | 아이디+비밀번호 로그인, 관리자가 발급한 초기 비밀번호로 최초 로그인 후 변경, 실패 시 한국어 오류("아이디 또는 비밀번호가 올바르지 않습니다"), 비회원 계정은 로그인 직후 차단 안내 |
| 2 | 대시보드 | `/dashboard` | 상태별 건수 카드, 내 담당 미완료 업무, 긴급/기한 임박 업무, 최근 처리 이력 10건, (6단계) 월별 접수·완료 통계 |
| 3 | 업무 목록 | `/tasks` | 표(업무번호·유형·제목·상태·우선순위·담당자·등록일·기한), 필터(상태·유형·우선순위·담당자·기간), 키워드, 정렬, 페이지네이션(20건), 필터는 URL 쿼리에 유지, 모바일에서는 카드형 |
| 4 | 신규 등록 | `/tasks/new` | 유형·제목·요청 내용·요청자·우선순위·담당자·기한 입력, 클라이언트+서버(zod) 검증, 저장 후 상세로 이동 및 "OMS-2026-0001 업무가 등록되었습니다" 안내 |
| 5 | 상세·처리 이력 | `/tasks/[taskNo]` | 기본 정보·수정, 상태 변경(완료 시 처리 결과 필수 모달, 재개 시 사유 입력), 담당자 변경, 처리 이력 작성, 로그+코멘트 통합 시간순 타임라인, 첨부파일 업로드/다운로드, 동시 수정 충돌 안내 |
| 6 | 통합 검색 | `/search?q=` | 제목·요청 내용·처리 결과·처리 이력 본문 검색, 결과에 일치 위치(제목/내용/이력) 표시, 상태·기간 필터 |
| 7 | 환경 설정 | `/settings` | 내 표시 이름 변경, 업무 유형 관리(관리자), 사용자 초대·비활성화(관리자, 최대 2명) |

공통 레이아웃: 왼쪽 사이드바(메뉴), 상단바(현재 사용자 이름·역할, 로그아웃), 토스트 알림(성공=초록, 오류=빨강, 충돌=노랑).

---

## 4. 구현 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **1** | 폴더 구조, 설계 문서, Supabase 클라이언트·미들웨어·환경변수 검증, 레이아웃 셸, 도메인 상수 | `npm run build`, `npm run lint`, `npm test` 통과, 설계 검토 요청 |
| 2 | SQL 마이그레이션(스키마·트리거·RLS·스토리지), 시드, pgTAP 테스트, 타입 생성 | `supabase db reset` 성공, `supabase test db` 통과 |
| 3 | 로그인/로그아웃, 회원 검증, 업무 목록(필터·페이지) | 비로그인·비회원 차단 확인, 목록 표시 |
| 4 | 업무 등록, 상세 조회·수정 | 업무번호 자동 발급, 검증 오류 안내 |
| 5 | 처리 이력, 상태/담당자 변경, 완료·재개 | 타임라인에 자동 로그 표시, 동시 수정 충돌 처리 |
| 6 | 통합 검색, 첨부파일, 대시보드 통계 | 한국어 부분 검색, 비공개 첨부 다운로드 |
| 7 | 권한·기능 테스트, Vercel 배포 | 통합 테스트 통과, 운영 환경 동작 확인 |

## 5. 확정된 결정 사항

1. **요청자**: 자유 텍스트(`requester`, 100자 이내).
2. **재개 시 처리 결과**: 직전 결과·완료일시·완료자를 `task_logs.detail`에 보존하고 업무의 `resolution`은 비운다.
3. **관리자**: 1명 admin, 1명 member. 차이는 업무 유형 관리·사용자 생성/비활성화뿐.
4. **첨부**: 파일당 20MB, 형식 제한 없음 (버킷 `file_size_limit` + 테이블 CHECK).
5. **로그인**: 아이디 + 비밀번호 (2.3 profiles 참고).

## 6. 구현 중 확인된 사항

- 클라이언트는 `task_year`, `task_seq`, `created_by`, `completed_at` 등 시스템 컬럼을 **보낼 권한 자체가 없다** (컬럼 단위 GRANT). 보내면 `42501`.
- 사용자 컨텍스트(`auth.uid()`)가 없는 업무 수정은 거부된다. service role로 업무를 직접 바꾸는 운영 작업도 막히므로, 데이터 보정은 마이그레이션으로 한다.
- `.local` 도메인 내부 이메일이 Supabase Auth에서 허용되는지는 3단계에서 실제 프로젝트로 확인한다. 거부되면 `LOGIN_EMAIL_DOMAIN` 상수만 바꾸면 된다.
