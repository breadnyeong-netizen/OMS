import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata = { title: "대시보드" };

export default function Page() {
  return <PagePlaceholder title="대시보드" stage={6} items={["상태별 건수", "내 담당 미완료 업무", "긴급·기한 임박 업무", "최근 처리 이력"]} />;
}
