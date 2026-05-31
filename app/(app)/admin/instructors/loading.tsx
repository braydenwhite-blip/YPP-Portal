import { Skeleton } from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <div className="instructor-ops-page">
      <div className="topbar">
        <div>
          <Skeleton width={180} height={20} radius={9999} style={{ display: "block", marginBottom: 10 }} />
          <Skeleton width={260} height={28} radius={8} style={{ display: "block", marginBottom: 8 }} />
          <Skeleton width={420} height={16} radius={6} style={{ display: "block" }} />
        </div>
      </div>

      <div className="grid four instructor-ops-metrics" style={{ marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <Skeleton width={60} height={32} radius={8} style={{ display: "block", marginBottom: 8 }} />
            <Skeleton width={120} height={14} radius={6} style={{ display: "block" }} />
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Skeleton width="100%" height={40} radius={8} style={{ display: "block" }} />
      </div>

      <div className="card" style={{ padding: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height={36}
            radius={6}
            style={{ display: "block", marginBottom: 8 }}
          />
        ))}
      </div>
    </div>
  );
}
