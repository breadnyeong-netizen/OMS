import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata = { title: "신규 업무 등록" };

export default function Page() {
  return <PagePlaceholder title="신규 업무 등록" stage={4} items={["업무번호 자동 발급", "입력 검증", "저장 안내 메시지"]} />;
}
