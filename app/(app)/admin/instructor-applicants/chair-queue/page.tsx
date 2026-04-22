import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getHiringActor, canSeeChairQueue } from "@/lib/chapter-hiring-permissions";
import { getChairQueue } from "@/lib/instructor-applicant-board-queries";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import ChairQueueClientWrapper from "./client";

export const dynamic = "force-dynamic";

export default async function ChairQueuePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect("/admin/instructor-applicants");
  }

  const actor = await getHiringActor(session.user.id);

  if (!canSeeChairQueue(actor)) {
    redirect("/admin/instructor-applicants");
  }

  const applications = await getChairQueue({ scope: "admin" });

  return (
    <div className="page-shell chair-queue-page">
      <div className="chair-queue-page-header">
        <span className="badge">Hiring Chair</span>
        <h1>Chair Queue</h1>
        <p>
          {applications.length} application{applications.length !== 1 ? "s" : ""} awaiting chair decision
        </p>
      </div>

      <ChairQueueClientWrapper initialApplications={applications} />
    </div>
  );
}
