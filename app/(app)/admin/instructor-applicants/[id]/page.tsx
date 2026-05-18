import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireApplicationReviewerPage } from "@/lib/page-guards";

export const dynamic = "force-dynamic";

/**
 * Redirect alias for /admin/instructor-applicants/[id].
 *
 * The actual applicant detail experience lives at /applications/instructor/[id]
 * (shared with reviewers/interviewers/applicants via role-scoped rendering).
 * For chair-status applications we send admins / hiring chairs directly to
 * the final review cockpit.
 *
 * Without this redirect, copy-pasted URLs like /admin/instructor-applicants/abc
 * 404, since only the /[id]/review/ subroute is implemented under this folder.
 */
export default async function AdminInstructorApplicantRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireApplicationReviewerPage();

  const { id } = await params;

  // Missing or unknown ids fall through to the canonical detail page, which
  // 404s correctly.
  const application = await prisma.instructorApplication.findUnique({
    where: { id },
    select: {
      status: true,
    },
  });

  if (application?.status === "CHAIR_REVIEW") {
    redirect(`/admin/instructor-applicants/${id}/review`);
  }

  redirect(`/applications/instructor/${id}`);
}
