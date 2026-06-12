/**
 * Skeleton matching the cockpit's above-the-fold shape (snapshot bar +
 * consensus card + signal panel). Skeletons cover the matrix and feed if
 * the payload streams late, never the snapshot — per §1.5 of the plan.
 * Tailwind-only (animate-pulse replaces the old .cockpit-skel shimmer).
 */

function Skel({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[6px] bg-brand-100/70 ${className}`} />;
}

export default function FinalReviewLoading() {
  return (
    <div className="min-h-screen bg-surface-soft">
      <div className="flex h-[72px] items-center gap-4 border-b border-line bg-surface px-6 py-3.5">
        <Skel className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skel className="h-4 w-2/5" />
          <Skel className="h-3 w-[30%]" />
        </div>
        <Skel className="h-9 w-24 rounded-[8px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-3">
          <Skel className="h-[120px] rounded-[16px]" />
          <Skel className="h-[200px] rounded-[16px]" />
          <Skel className="h-[200px] rounded-[16px]" />
        </div>
        <div className="flex flex-col gap-3">
          <Skel className="h-[220px] rounded-[16px]" />
          <Skel className="h-[160px] rounded-[16px]" />
        </div>
      </div>
    </div>
  );
}
