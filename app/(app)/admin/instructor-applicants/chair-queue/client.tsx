"use client";

import { Suspense } from "react";

import InstructorApplicantsWorkspace, {
  type WorkspaceApplicant,
} from "@/components/instructor-applicants/InstructorApplicantsWorkspace";

export default function ChairQueueClientWrapper({
  initialApplications,
}: {
  initialApplications: WorkspaceApplicant[];
}) {
  return (
    <Suspense fallback={<p className="text-[13px] text-[#9a9ab0]">Loading…</p>}>
      <InstructorApplicantsWorkspace applications={initialApplications} canDecide />
    </Suspense>
  );
}
