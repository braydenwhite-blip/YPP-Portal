import { enforceInstructorGate } from "@/lib/instructor-gate";

export const dynamic = "force-dynamic";

/**
 * `/training/[id]` hosts instructor training modules. While the regular
 * Instructor program is paused these are hidden from non-admin users.
 */
export default async function TrainingSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceInstructorGate();
  return <>{children}</>;
}
