import { enforceInstructorGate } from "@/lib/instructor-gate";

export const dynamic = "force-dynamic";

/**
 * Temporary gate: while the regular Instructor program is paused, every
 * route under `/instructor/*` is hidden from non-admin users. Admins
 * always bypass via role — see `lib/feature-flags.ts`.
 *
 * Note: layouts don't receive `searchParams`, so the `?adminPreview=1`
 * affordance is enforced inside leaf pages where it matters.
 */
export default async function InstructorSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceInstructorGate();
  return <>{children}</>;
}
