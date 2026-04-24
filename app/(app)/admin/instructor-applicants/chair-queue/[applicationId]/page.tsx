import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { canSeeChairQueue, getHiringActor } from "@/lib/chapter-hiring-permissions";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { getChairQueueItem } from "@/lib/instructor-applicant-board-queries";
import ChairDecisionWorkspace from "@/components/instructor-applicants/ChairDecisionWorkspace";

export const dynamic = "force-dynamic";

export default async function ChairReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect("/admin/instructor-applicants");
  }

  const actor = await getHiringActor(session.user.id);

  if (!canSeeChairQueue(actor)) {
    redirect("/admin/instructor-applicants");
  }

  const { applicationId } = await params;
  const application = await getChairQueueItem({
    scope: "admin",
    applicationId,
  });

  if (!application) {
    notFound();
  }

  const displayName =
    application.preferredFirstName ?? application.legalName ?? application.applicant.name ?? "Applicant";

  return (
    <div className="page-shell chair-review-page">
      <div className="chair-review-backbar">
        <Link href="/admin/instructor-applicants/chair-queue" className="applicant-cockpit-backlink">
          ← Back to Chair Queue
        </Link>
      </div>

      <div className="chair-review-page-header">
        <span className="badge">Hiring Chair</span>
        <h1>{displayName}</h1>
        <p>
          Full chair review workspace. Review the evidence, write your rationale, and record the
          final decision here.
        </p>
      </div>

      <ChairDecisionWorkspace
        application={application}
        backHref="/admin/instructor-applicants/chair-queue"
      />
    </div>
  );
}
