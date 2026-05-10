import { headers } from "next/headers";
import { enforceInstructorGate } from "@/lib/instructor-gate";

export const dynamic = "force-dynamic";

/**
 * Temporary gate: while the regular Instructor program is paused, every
 * route under `/instructor/*` is hidden from non-admin users. Admins
 * always bypass via role — see `lib/feature-flags.ts`.
 *
 * SW-subtype users get into `/instructor/workshop-design-studio/*` —
 * the gate reads the actual request pathname from the `x-pathname`
 * header set by `proxy.ts` and consults
 * `SUMMER_WORKSHOP_PERMITTED_HREF_PREFIXES`.
 *
 * Note: layouts don't receive `searchParams`, so the `?adminPreview=1`
 * affordance is enforced inside leaf pages where it matters.
 */
export default async function InstructorSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-pathname");
  await enforceInstructorGate({ pathname });
  return <>{children}</>;
}
