import {
  SuiteHeaderSkeleton,
  StatStripSkeleton,
  CardListSkeleton,
} from "@/components/people-strategy/suite-skeletons";

// Rendered inside the chapter layout, which already provides the
// `.ps-page psuite` premium canvas — so no extra wrapper here.
export default function Loading() {
  return (
    <div>
      <SuiteHeaderSkeleton />
      <StatStripSkeleton count={5} />
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <CardListSkeleton count={4} />
        <CardListSkeleton count={4} />
      </div>
    </div>
  );
}
