import Link from "next/link";
import { redirect } from "next/navigation";
import { getHiringActor, isAdmin } from "@/lib/chapter-hiring-permissions";
import { getChairQueue } from "@/lib/instructor-applicant-board-queries";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { requireChairPage } from "@/lib/page-guards";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import ChairQueueClientWrapper from "./client";

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

  return (
    <div className="page-shell chair-queue-page">
      <div className="chair-queue-page-header">
        <span className="badge">Hiring Chair</span>
        <h1>Chair Queue</h1>
        <p>
          {applications.length} application{applications.length !== 1 ? "s" : ""} awaiting chair decision.
          {oldestDays !== null
            ? ` Oldest has been waiting ${oldestDays} day${oldestDays === 1 ? "" : "s"}.`
            : ""}
          {" "}Open any row to launch the full chair review workspace.
        </p>
        <div style={{ marginTop: 8 }}>
          <Link href="/admin/instructor-applicants/activity" className="link">
            See all reviewer activity →
          </Link>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>No pending chair decisions</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            The Chair Queue is clear. New chair-pending applications will appear here when reviewers and interviewers send them up.
          </p>
        </div>
      ) : (
        <ChairQueueClientWrapper initialApplications={applications} />
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Recently decided</h2>
            <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
              Chair decisions in the last {RECENT_WINDOW_DAYS} days. Open any row to view its audit history.
            </p>
          </div>
        </div>
        {recentDecisionRows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No chair decisions in the last {RECENT_WINDOW_DAYS} days.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {recentDecisionRows.map((row) => {
              const displayName = deriveDisplayName(row.application);
              const chapterName = row.application.applicant?.chapter?.name ?? null;
              const isMine = row.chair?.id === actor.id;
              return (
                <li
                  key={row.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      href={`/admin/instructor-applicants/${row.applicationId}/review`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <strong>{displayName}</strong>
                      {chapterName ? (
                        <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                          · {chapterName}
                        </span>
                      ) : null}
                    </Link>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {formatActionLabel(row.action)} · {formatDateTime(row.decidedAt)}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
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
      </section>
    </div>
  );
}
