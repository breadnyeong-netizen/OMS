export function PagePlaceholder({ title, stage, items }: { title: string; stage: number; items: string[] }) {
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        <p className="mb-2 font-medium">{stage}단계에서 구현 예정</p>
        <ul className="list-disc pl-5">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
