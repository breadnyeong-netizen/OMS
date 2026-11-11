import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata = { title: "환경 설정" };

export default function Page() {
  return <PagePlaceholder title="환경 설정" stage={3} items={["표시 이름 변경", "업무 유형 관리", "사용자 초대(최대 2명)"]} />;
}
