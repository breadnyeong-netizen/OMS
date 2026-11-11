export const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/tasks", label: "업무 목록" },
  { href: "/tasks/new", label: "신규 업무 등록" },
  { href: "/search", label: "통합 검색" },
  { href: "/settings", label: "환경 설정" },
] as const;

/** 현재 경로에 가장 길게 일치하는 메뉴만 활성화 (/tasks/new 에서 '업무 목록'이 함께 켜지지 않도록) */
export function activeHref(pathname: string): string | undefined {
  return NAV_ITEMS.map((i) => i.href)
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}
