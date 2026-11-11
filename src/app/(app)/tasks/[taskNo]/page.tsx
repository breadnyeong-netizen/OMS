import { notFound } from "next/navigation";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { parseTaskNo } from "@/lib/domain/task";

export default async function Page({ params }: { params: Promise<{ taskNo: string }> }) {
  const { taskNo } = await params;
  if (!parseTaskNo(taskNo)) notFound();
  return (
    <PagePlaceholder
      title={`업무 상세 · ${taskNo}`}
      stage={4}
      items={["기본 정보·수정", "상태/담당자 변경 (5단계)", "시간순 처리 이력 (5단계)", "첨부파일 (6단계)"]}
    />
  );
}
