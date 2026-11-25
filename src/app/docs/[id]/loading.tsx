export default function DocumentLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-14 border-b border-border bg-card" />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 h-5 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mb-6 h-10 w-2/3 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-[520px] animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}

