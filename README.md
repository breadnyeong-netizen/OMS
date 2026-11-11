# OMS — 2인용 통합 업무 관리 시스템

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL / Auth / Storage) · Vercel

설계: [docs/DESIGN.md](docs/DESIGN.md) — 폴더 구조, DB 설계, 화면 명세, 구현 순서.
모든 개발·테스트 데이터는 가상 데이터만 사용한다.

## 현재 단계: 1단계 (구조·설계)

### 실행 방법
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
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | 관리자 초대에만 사용. `NEXT_PUBLIC_` 금지 |
| `SITE_URL` | 서버 전용 | 초대 메일 리다이렉트 주소 |

### 테스트
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
단위 테스트: 업무번호 형식, 상태 전이 규칙, 공개 경로 판정, service role 키 노출 방지(정적 검사).

### 완료 기준
- [x] 폴더 구조·설계 문서 작성
- [x] Supabase 브라우저/서버/관리자 클라이언트 분리, `server-only`로 비밀키 격리
- [x] 미들웨어: 비로그인 시 `/login?next=...` 리다이렉트
- [x] 사이드바·상단바 레이아웃 셸, 7개 화면 라우트(플레이스홀더)
- [x] typecheck / lint / test / build 통과
- [ ] 설계 검토 및 확정 → 2단계(SQL 마이그레이션) 진행
