import { enforceInstructorGate } from "@/lib/instructor-gate";

export const dynamic = "force-dynamic";

export default async function InstructorTrainingSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceInstructorGate();
  return <>{children}</>;
}
