import { Skeleton } from "@/components/shared/skeleton";

/**
 * Layout-shaped skeletons for the People Suite surfaces. Compose these inside a
 * route `loading.tsx` so a navigation shows the premium command-bar + stat-strip
 * + content silhouette instead of a blank slot — the page "arrives" in place.
 */

export function SuiteHeaderSkeleton() {
  return (
    <header className="ps-command-bar">
      <div className="ps-command-headings">
        <Skeleton width={150} height={24} radius={999} style={{ display: "block", marginBottom: 12 }} />
        <Skeleton width={280} height={32} radius={10} style={{ display: "block", marginBottom: 10 }} />
        <Skeleton width={460} height={16} radius={6} style={{ display: "block", maxWidth: "100%" }} />
      </div>
    </header>
  );
}

export function StatStripSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="psuite-stat-strip">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flex: "1 1 150px", minWidth: 140 }}>
          <div className="ps-stat-card">
            <div className="ps-stat-head">
              <Skeleton width={70} height={11} radius={4} />
              <Skeleton width={32} height={32} radius={10} />
            </div>
            <Skeleton width={56} height={28} radius={8} style={{ display: "block", marginTop: 14 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: "grid", gap: 12 }}>
          <Skeleton width="38%" height={18} radius={6} />
          <Skeleton width="58%" height={13} radius={6} />
          <Skeleton width="100%" height={8} radius={999} style={{ marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "linear-gradient(180deg, #faf8ff, #f1ebfb)" }}>
        <Skeleton width="100%" height={14} radius={6} />
      </div>
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton width={36} height={36} radius={999} />
            <Skeleton width="22%" height={14} radius={6} />
            <Skeleton width="13%" height={14} radius={6} />
            <Skeleton width="13%" height={14} radius={6} />
            <Skeleton width="16%" height={8} radius={999} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
