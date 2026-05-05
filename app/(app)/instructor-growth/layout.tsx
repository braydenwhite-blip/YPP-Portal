import { enforceInstructorGate } from "@/lib/instructor-gate";

export const dynamic = "force-dynamic";

export default async function InstructorGrowthSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceInstructorGate();
  return <>{children}</>;
}
