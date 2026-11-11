import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata = { title: "업무 목록" };

export default function Page() {
  return <PagePlaceholder title="업무 목록" stage={3} items={["표 기반 목록", "상태·유형·우선순위·담당자 필터", "정렬·페이지네이션"]} />;
}
