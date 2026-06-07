import {
  SuiteHeaderSkeleton,
  StatStripSkeleton,
  CardListSkeleton,
} from "@/components/people-strategy/suite-skeletons";

export default function Loading() {
  return (
    <div className="ps-page psuite">
      <SuiteHeaderSkeleton />
      <StatStripSkeleton count={5} />
      <CardListSkeleton count={4} />
    </div>
  );
}
