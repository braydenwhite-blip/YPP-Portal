import {
  SuiteHeaderSkeleton,
  StatStripSkeleton,
  TableSkeleton,
} from "@/components/people-strategy/suite-skeletons";

export default function Loading() {
  return (
    <div className="ps-page psuite">
      <SuiteHeaderSkeleton />
      <StatStripSkeleton count={5} />
      <TableSkeleton rows={9} />
    </div>
  );
}
