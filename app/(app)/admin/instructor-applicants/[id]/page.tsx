import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isFinalReviewV2EnabledForChapter } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Redirect alias for /admin/instructor-applicants/[id].
 *
 * The actual applicant detail experience lives at /applications/instructor/[id]
 * (shared with reviewers/interviewers/applicants via role-scoped rendering).
 * For chair-status applications we send admins / hiring chairs directly to
 * the final review cockpit (V2 if enabled for the applicant's chapter,
 * otherwise the legacy V1 chair queue workspace).
 *
 * Without this redirect, copy-pasted URLs like /admin/instructor-applicants/abc
 * 404, since only the /[id]/review/ subroute is implemented under this folder.
 */
export default async function AdminInstructorApplicantRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  // Resolve the applicant's chapter so we can route chair-status decisions
  // to the right cockpit. Missing or unknown ids fall through to the
  // canonical detail page, which 404s correctly.
  const application = await prisma.instructorApplication.findUnique({
    where: { id },
    select: {
      status: true,
      applicant: { select: { chapterId: true } },
    },
  });

  if (application?.status === "CHAIR_REVIEW") {
    const v2 = isFinalReviewV2EnabledForChapter(application.applicant.chapterId ?? null);
    redirect(
      v2
        ? `/admin/instructor-applicants/${id}/review`
        : `/admin/instructor-applicants/chair-queue/${id}`
    );
  }

  redirect(`/applications/instructor/${id}`);
}
