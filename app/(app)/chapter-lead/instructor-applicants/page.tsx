import { redirect } from "next/navigation";

/**
 * Chapter President instructor applicants are now consolidated into the
 * main Kanban board at /admin/instructor-applicants, which auto-filters
 * by chapter for non-admin users.
 */
export default function ChapterLeadInstructorApplicantsRedirect() {
  redirect("/admin/instructor-applicants");
}
