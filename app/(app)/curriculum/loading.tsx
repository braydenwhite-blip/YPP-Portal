import { Skeleton } from "@/components/shared/skeleton";

export default function CurriculumLoading() {
  return (
    <div aria-busy="true" aria-label="Loading classes">
      <div className="topbar">
        <div>
          <Skeleton width={88} height={20} radius={999} style={{ marginBottom: 10 }} />
          <Skeleton width={240} height={30} radius={8} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <Skeleton height={44} radius={12} style={{ marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={108} height={32} radius={999} />
          ))}
        </div>
      </div>

      <div className="grid two">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={244} radius={20} />
        ))}
      </div>
    </div>
  );
}
