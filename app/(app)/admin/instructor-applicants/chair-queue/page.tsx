import Link from "next/link";
import { redirect } from "next/navigation";

import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { getHiringActor, isAdmin } from "@/lib/chapter-hiring-permissions";
import { getChairQueue } from "@/lib/instructor-applicant-board-queries";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { requireChairPage } from "@/lib/page-guards";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { recommendedNextStep } from "@/lib/instructor-applicants/workspace-display";
import ChairQueueTriage from "@/components/instructor-applicants/ChairQueueTriage";

/** One headline readout inside the "Queue at a glance" band. */
function Readout({
  value,
  label,
  detail,
  tone = "default",
}: {
  value: string | number;
  label: string;
  detail?: string;
  tone?: "default" | "success" | "danger";
}) {
  const valueColor =
    tone === "success"
      ? "text-success-700"
      : tone === "danger"
        ? "text-danger-700"
        : "text-ink";
  return (
    <div>
      <div className={`text-[26px] font-extrabold leading-none ${valueColor}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </div>
      {detail ? (
        <div className="mt-0.5 text-[11.5px] text-ink-muted">{detail}</div>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";

const RECENT_WINDOW_DAYS = 14;
const RECENT_LIMIT = 10;

const ACTION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved (conditions)",
  REJECT: "Rejected",
  HOLD: "Held",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Info requested",
  REQUEST_SECOND_INTERVIEW: "2nd interview",
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function deriveDisplayName(app: {
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  applicant: { name: string | null } | null;
}): string {
  return formatApplicantDisplayName({
    preferredFirstName: app.preferredFirstName,
    lastName: app.lastName,
    legalName: app.legalName,
    applicant: app.applicant,
  });
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

export default async function ChairQueuePage() {
  const sessionUser = await requireChairPage();
  const actor = await getHiringActor(sessionUser.id);

  // Feature-flag fallback: when the V1 workflow is paused, only ADMIN has any
  // alternative surface to land on. Send pure HIRING_CHAIRs back to / so the
  // chair home explains the state instead of bouncing through an admin-only
  // page.
  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect(isAdmin(actor) ? "/admin/instructor-applicants" : "/");
  }

  const [applications, recentDecisionRows] = await Promise.all([
    getChairQueue({ scope: "admin" }),
    prisma.instructorApplicationChairDecision
      .findMany({
        where: {
          supersededAt: null,
          decidedAt: {
            gte: new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000),
          },
        },
        orderBy: { decidedAt: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          applicationId: true,
          action: true,
          decidedAt: true,
          chair: { select: { id: true, name: true } },
          application: {
            select: {
              preferredFirstName: true,
              lastName: true,
              legalName: true,
              applicant: {
                select: { name: true, chapter: { select: { name: true } } },
              },
            },
          },
        },
      })
      .catch((error: unknown) => {
        const code = (error as { code?: string } | null)?.code;
        if (code === "P2021" || code === "P2022") return [];
        throw error;
      }),
  ]);

  const oldestQueued = applications
    .map((app) => app.chairQueuedAt)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const oldestDays = daysSince(oldestQueued);

  // Consensus mix across the queue — the chair's triage read. `tone` from
  // recommendedNextStep already encodes accept (success) / discuss (warning) /
  // decline (danger) / awaiting-reviews (neutral).
  const recTones = applications.map(
    (app) => recommendedNextStep(app.interviewReviews).tone
  );
  const leaningAccept = recTones.filter((t) => t === "success").length;
  const needsDiscussion = recTones.filter(
    (t) => t === "warning" || t === "danger"
  ).length;

  return (
    <ApplicationReviewShell
      maxWidth={1100}
      header={
        <PageHeaderV2
          eyebrow="Hiring chair"
          title="Chair queue"
          subtitle={`${applications.length} application${applications.length !== 1 ? "s" : ""} awaiting chair decision.${
            oldestDays !== null
              ? ` Oldest has been waiting ${oldestDays} day${oldestDays === 1 ? "" : "s"}.`
              : ""
          } Reviews already written come first — confirm the recommended next step.`}
          actions={
            <Link
              href="/admin/instructor-applicants/activity"
              className="text-[13px] font-semibold text-brand-700 hover:underline"
            >
              See all reviewer activity →
            </Link>
          }
        />
      }
      actions={[
        { label: "Application board", href: "/admin/instructor-applicants", icon: "list" },
      ]}
    >
      {applications.length === 0 ? (
        <CardV2 padding="lg">
          <h2 className="m-0 text-[16px] font-semibold text-ink">No pending chair decisions</h2>
          <p className="m-0 mt-1.5 text-[13.5px] text-ink-muted">
            The Chair Queue is clear. New chair-pending applications will appear here when reviewers and interviewers send them up.
          </p>
        </CardV2>
      ) : (
        <>
          {/* Queue at a glance — the triage read before opening any one record. */}
          <CardV2 padding="lg">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Queue at a glance
            </p>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4">
              <Readout value={applications.length} label="Awaiting decision" />
              <Readout
                value={oldestDays ?? "—"}
                label="Oldest wait"
                detail={
                  oldestDays !== null
                    ? `day${oldestDays === 1 ? "" : "s"} in queue`
                    : undefined
                }
                tone={oldestDays !== null && oldestDays >= 7 ? "danger" : "default"}
              />
              <Readout value={leaningAccept} label="Leaning accept" tone="success" />
              <Readout
                value={needsDiscussion}
                label="Needs discussion"
                detail="hold or decline signals"
                tone={needsDiscussion > 0 ? "danger" : "default"}
              />
            </div>
          </CardV2>

          <ChairQueueTriage applications={applications} />
        </>
      )}

      <CardV2 as="section" padding="lg">
        <div className="mb-3">
          <h2 className="m-0 text-[16px] font-semibold text-ink">Recently decided</h2>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Chair decisions in the last {RECENT_WINDOW_DAYS} days. Open any row to view its audit history.
          </p>
        </div>
        {recentDecisionRows.length === 0 ? (
          <p className="m-0 text-[13.5px] text-ink-muted">
            No chair decisions in the last {RECENT_WINDOW_DAYS} days.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {recentDecisionRows.map((row) => {
              const displayName = deriveDisplayName(row.application);
              const chapterName = row.application.applicant?.chapter?.name ?? null;
              const isMine = row.chair?.id === actor.id;
              return (
                <li
                  key={row.id}
                  className="rounded-[8px] border border-line-soft bg-surface px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/admin/instructor-applicants/${row.applicationId}/review`}
                      className="text-inherit no-underline hover:underline"
                    >
                      <strong className="text-[13.5px] font-semibold text-ink">{displayName}</strong>
                      {chapterName ? (
                        <span className="ml-2 text-[12.5px] text-ink-muted">· {chapterName}</span>
                      ) : null}
                    </Link>
                    <span className="whitespace-nowrap text-[12.5px] text-ink-muted">
                      {formatActionLabel(row.action)} · {formatDateTime(row.decidedAt)}
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                    {isMine
                      ? "Decided by you"
                      : row.chair?.name
                      ? `Decided by ${row.chair.name}`
                      : "Decided"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardV2>
    </ApplicationReviewShell>
  );
}
