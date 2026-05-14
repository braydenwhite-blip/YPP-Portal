/**
 * Soft-archive every applicant submission across all five submission tables.
 *
 * Run with: pnpm archive:all-applications  (or `npm run`)
 *
 * Idempotent: re-running after a successful run reports zero archived rows.
 * Does not delete data; sets archivedAt = now() so admin list views (which
 * filter on archivedAt: null) treat the rows as cleared.
 */

import { archiveAllApplicantSubmissions } from "../lib/instructor-application-actions";

async function main() {
  const result = await archiveAllApplicantSubmissions({
    reason: "manual-script",
  });

  console.log("Archived applicant submissions:");
  console.table([
    { table: "InstructorApplication", archived: result.instructorApplications },
    { table: "Application", archived: result.applications },
    { table: "ChapterPresidentApplication", archived: result.chapterPresidentApplications },
    { table: "IncubatorApplication", archived: result.incubatorApplications },
    { table: "InternshipApplication", archived: result.internshipApplications },
    { table: "TOTAL", archived: result.total },
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[archive-all-applications] failed:", err);
    process.exit(1);
  });
