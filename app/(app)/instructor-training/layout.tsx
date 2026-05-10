import { headers } from "next/headers";
import { enforceInstructorGate } from "@/lib/instructor-gate";

export const dynamic = "force-dynamic";

export default async function InstructorTrainingSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pass the request pathname through so SW-subtype users (approved
  // Summer Workshop Instructors) can reach required training even while
  // the regular instructor program is paused.
  const h = await headers();
  const pathname = h.get("x-pathname");
  await enforceInstructorGate({ pathname });
  return <>{children}</>;
}
