export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-slate-50/85 p-4 lg:block">
        <div className="mb-8 h-8 w-36 animate-pulse rounded-lg bg-slate-200" />
        <div className="space-y-2">
          <div className="h-9 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-9 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-9 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </aside>
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8 sm:px-8">
        <div className="mb-8 h-12 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-5"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
