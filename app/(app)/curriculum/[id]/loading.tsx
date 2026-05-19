import { Skeleton } from "@/components/shared/skeleton";

export default function ClassDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading class">
      <Skeleton width={150} height={16} radius={6} style={{ marginBottom: 20 }} />
      <Skeleton height={196} radius={20} style={{ marginBottom: 24 }} />
      <div className="grid two">
        <Skeleton height={268} radius={20} />
        <Skeleton height={268} radius={20} />
      </div>
    </div>
  );
}
