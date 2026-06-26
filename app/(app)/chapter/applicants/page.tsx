import { redirect } from "next/navigation";

import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";

// The legacy chapter applicants list consolidated into the modern ui-v2
// applicant board (the catalog's "Chapter Applicants"). When the v1 workflow
// is disabled, fall back to the chapter recruiting hub so a CP is never sent to
// a disabled surface.
export default function ChapterApplicantsRedirect() {
  redirect(
    isInstructorApplicantWorkflowV1Enabled()
      ? "/chapter-lead/instructor-applicants"
      : "/chapter/recruiting"
  );
}
