export default function InstructorLoading() {
  return (
    <main aria-busy="true" aria-label="Loading instructor workspace" className="mx-auto w-full max-w-[1040px] animate-pulse px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="h-3 w-24 rounded bg-surface-soft" />
      <div className="mt-3 h-9 w-64 max-w-full rounded bg-surface-soft" />
      <div className="mt-3 h-4 w-[520px] max-w-full rounded bg-surface-soft" />
      <div className="mt-8 h-56 rounded-[18px] border border-line-card bg-surface-soft" />
      <div className="mt-8 space-y-3">
        <div className="h-24 rounded-[14px] border border-line-card bg-surface-soft" />
        <div className="h-24 rounded-[14px] border border-line-card bg-surface-soft" />
      </div>
    </main>
  );
}

