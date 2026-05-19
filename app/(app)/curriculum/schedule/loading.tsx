import { Skeleton } from "@/components/shared/skeleton";

export default function ScheduleLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your schedule">
      <div className="topbar">
        <div>
          <Skeleton width={88} height={20} radius={999} style={{ marginBottom: 10 }} />
          <Skeleton width={220} height={30} radius={8} />
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={94} radius={16} />
        ))}
      </div>

      <Skeleton height={150} radius={20} style={{ marginBottom: 16 }} />
      <Skeleton height={320} radius={20} />
    </div>
  );
}
