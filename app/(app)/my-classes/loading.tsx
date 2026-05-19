import { Skeleton } from "@/components/shared/skeleton";

export default function MyClassesLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your classes">
      <div className="topbar">
        <div>
          <Skeleton width={88} height={20} radius={999} style={{ marginBottom: 10 }} />
          <Skeleton width={200} height={30} radius={8} />
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={94} radius={16} />
        ))}
      </div>

      <Skeleton height={132} radius={20} style={{ marginBottom: 16 }} />

      <div className="grid two">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={176} radius={20} />
        ))}
      </div>
    </div>
  );
}
