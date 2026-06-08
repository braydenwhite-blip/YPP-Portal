import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { hasAnyRole, OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import { listMentorshipApplications } from "@/lib/mentorship-2/queries";
import {
  MENTORSHIP_APPLICATION_STATUSES,
  isMentorshipApplicationStatus,
  type MentorshipApplicationStatus,
} from "@/lib/mentorship-2/constants";
import {
  ApplicationsQueue,
  type ApplicationRow,
} from "@/components/mentorship-2/applications-queue";

export const metadata = { title: "Mentorship Applications — YPP" };

export default async function MentorshipApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!isMentorship2Enabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (
    !hasAnyRole(
      session.user.roles ?? [],
      [...OFFICER_TIER_ROLES],
      session.user.primaryRole ?? null
    )
  ) {
    redirect("/");
  }

  const { status: statusParam } = await searchParams;
  const statusFilter: MentorshipApplicationStatus[] | undefined =
    statusParam && isMentorshipApplicationStatus(statusParam)
      ? [statusParam]
      : statusParam === "open"
        ? ["SUBMITTED", "UNDER_REVIEW"]
        : undefined;

  const applications = await listMentorshipApplications({ statuses: statusFilter });

  const rows: ApplicationRow[] = applications.map((app) => ({
    id: app.id,
    status: app.status as MentorshipApplicationStatus,
    applicantName: app.applicant?.name ?? null,
    applicantEmail: app.applicant?.email ?? "",
    goals: app.goals,
    interests: app.interests,
    preferredExpertise: app.preferredExpertise,
    availability: app.availability,
    motivation: app.motivation,
    createdAt: app.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Mentorship applications</h1>
          <p className="page-subtitle">
            Mentee-initiated requests for mentorship. Review each one and record
            an outcome.
          </p>
        </div>
        <Link href="/admin/mentorship" className="button secondary small">
          ← Mentorship oversight
        </Link>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Link
          href="/admin/mentorship/applications?status=open"
          className="button secondary small"
        >
          Open
        </Link>
        {MENTORSHIP_APPLICATION_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/mentorship/applications?status=${status}`}
            className="button secondary small"
          >
            {status.replace(/_/g, " ").toLowerCase()}
          </Link>
        ))}
        <Link href="/admin/mentorship/applications" className="button secondary small">
          All
        </Link>
      </div>

      <ApplicationsQueue applications={rows} />
    </div>
  );
}
