import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  reassignProgramMentor,
  setProgramMentorshipStatus,
} from "@/lib/mentorship-program-actions";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { getOperationalContextForEntity } from "@/lib/people-strategy/operational-context-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";
import { OperationalContextPanel } from "@/components/people-strategy/operational-context-panel";
import { OperationalTimeline } from "@/components/people-strategy/operational-timeline";
import { deriveOperationalTimeline } from "@/lib/people-strategy/operational-timeline";
import { deriveStrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";
import { StrategicEntityPanel } from "@/components/people-strategy/strategic-entity-panel";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import {
  RelationshipDetailCalm,
  type CalmDetailFact,
  type CalmDetailFocus,
} from "@/components/mentorship/calm";
import type { StatusTone } from "@/components/ui-v2";

export const metadata = {
  title: "Instructor mentorship relationship — Admin",
};

const STALE_SESSION_DAYS = 30;

/** Plain-language cycle labels for the Calm relationship summary. */
const CALM_CYCLE_LABEL: Record<string, string> = {
  KICKOFF_PENDING: "Kickoff pending",
  REFLECTION_DUE: "Reflection due",
  REFLECTION_SUBMITTED: "Ready for review",
  CHANGES_REQUESTED: "Changes requested",
  REVIEW_SUBMITTED: "With the chair",
  APPROVED: "Up to date",
  PAUSED: "Paused",
  COMPLETE: "Cycle complete",
};

export default async function AdminMentorshipRelationshipDetailPage({
  params,
}: {
  params: { mentorshipId: string };
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: params.mentorshipId },
    include: {
      mentor: {
        select: { id: true, name: true, email: true, primaryRole: true },
      },
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
      track: { select: { id: true, name: true } },
      chair: { select: { id: true, name: true } },
      sessions: {
        orderBy: [{ completedAt: "desc" }, { scheduledAt: "desc" }],
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          scheduledAt: true,
          completedAt: true,
        },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, notes: true, rating: true, createdAt: true },
      },
      goalReviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          cycleMonth: true,
          overallRating: true,
          chairApprovedAt: true,
          createdAt: true,
        },
      },
      grDocuments: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          goals: {
            orderBy: [{ sortOrder: "asc" }],
            select: {
              id: true,
              title: true,
              progressState: true,
              lifecycleStatus: true,
              dueDate: true,
            },
          },
        },
      },
      circleMembers: {
        where: { isActive: true },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!mentorship) {
    notFound();
  }

  const eligibleMentors = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "MENTOR" } } },
        { roles: { some: { role: "ADMIN" } } },
        { primaryRole: "INSTRUCTOR" },
        { primaryRole: "CHAPTER_PRESIDENT" },
      ],
      NOT: { id: { in: [mentorship.mentorId, mentorship.menteeId] } },
    },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
  });

  // Phase 7 connective tissue — cross-team Action Tracker items linked to this
  // mentorship (parity with the mentee workspace). Behind the same operations +
  // tracker flags; MENTORSHIP is already a resolved polymorphic link type.
  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();
  const viewer = {
    id: session?.user?.id ?? "",
    roles: session?.user?.roles ?? [],
    primaryRole: session?.user?.primaryRole ?? null,
    adminSubtypes: session?.user?.adminSubtypes ?? [],
  };
  const opsContext = operationsEnabled
    ? await getOperationalContextForEntity("MENTORSHIP", mentorship.id, viewer)
    : null;

  const now = new Date();
  const staleSessionCutoff = new Date(
    now.getTime() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000
  );
  const latestActivity =
    mentorship.sessions.find((session) => session.completedAt)?.completedAt ??
    mentorship.sessions[0]?.scheduledAt ??
    null;
  const hasUpcoming = mentorship.sessions.some(
    (session) => !session.completedAt && session.scheduledAt > now
  );
  const isOverdueCheckIn =
    !hasUpcoming && (!latestActivity || latestActivity < staleSessionCutoff);
  const grDoc = mentorship.grDocuments[0] ?? null;
  const stalledGoals = grDoc
    ? grDoc.goals.filter(
        (goal) =>
          goal.lifecycleStatus === "ACTIVE" &&
          (goal.progressState === "BLOCKED" ||
            (goal.dueDate && goal.dueDate < now && goal.progressState !== "DONE"))
      )
    : [];

  const statusToneClass =
    mentorship.status === "ACTIVE"
      ? "pill-success"
      : mentorship.status === "PAUSED"
      ? "pill-pending"
      : "pill-declined";

  // Calm summary — what an admin needs to decide at a glance. Built from data
  // already loaded; Executive supersedes it with the full record + controls.
  const menteeWorkspaceHref = `/mentorship/mentees/${mentorship.menteeId}`;
  const calmGoals: CalmDetailFact[] = (grDoc?.goals ?? [])
    .filter((goal) => goal.lifecycleStatus === "ACTIVE")
    .slice(0, 5)
    .map((goal) => {
      const overdue =
        goal.dueDate && goal.dueDate < now && goal.progressState !== "DONE";
      return {
        id: goal.id,
        title: goal.title,
        meta: `${goal.progressState.replace(/_/g, " ").toLowerCase()}${
          goal.dueDate ? ` · due ${new Date(goal.dueDate).toLocaleDateString()}` : ""
        }`,
        status: overdue
          ? { label: "Overdue", tone: "danger" as StatusTone }
          : goal.progressState === "BLOCKED"
          ? { label: "Blocked", tone: "warning" as StatusTone }
          : null,
      };
    });

  let calmFocus: CalmDetailFocus;
  if (mentorship.status !== "ACTIVE") {
    calmFocus = {
      eyebrow: "Status",
      title: `This mentorship is ${mentorship.status.toLowerCase()}`,
      reason: "Reactivate it or review the full record below.",
      ctaLabel: "Open mentee workspace",
      ctaHref: menteeWorkspaceHref,
    };
  } else if (isOverdueCheckIn) {
    calmFocus = {
      eyebrow: "Needs a touchpoint",
      title: `Follow up on ${mentorship.mentee.name}`,
      reason: `No completed session in ${STALE_SESSION_DAYS}+ days — check in with ${mentorship.mentor.name}.`,
      ctaLabel: "Open mentee workspace",
      ctaHref: menteeWorkspaceHref,
    };
  } else if (stalledGoals.length > 0) {
    calmFocus = {
      eyebrow: "Goals need attention",
      title: `${stalledGoals.length} goal${stalledGoals.length === 1 ? "" : "s"} stalled or overdue`,
      reason: "Review the goals & resources plan with the mentor.",
      ctaLabel: "Open mentee workspace",
      ctaHref: menteeWorkspaceHref,
    };
  } else {
    calmFocus = {
      eyebrow: "On track",
      title: `${mentorship.mentee.name} is on track`,
      reason: "Nothing flags for admin attention right now.",
      tone: "success",
      ctaLabel: "Open mentee workspace",
      ctaHref: menteeWorkspaceHref,
    };
  }

  const calmStatusTone: StatusTone =
    mentorship.status !== "ACTIVE"
      ? "neutral"
      : isOverdueCheckIn || stalledGoals.length > 0
      ? "warning"
      : "success";
  const calmStatusLabel = `${mentorship.status.charAt(0)}${mentorship.status
    .slice(1)
    .toLowerCase()}${
    mentorship.cycleStage ? ` · ${CALM_CYCLE_LABEL[mentorship.cycleStage] ?? ""}` : ""
  }`;
  const calmSummary = (
    <RelationshipDetailCalm
      status={{ label: calmStatusLabel, tone: calmStatusTone }}
      contextLine={`Mentor: ${mentorship.mentor.name}${
        mentorship.mentee.chapter ? ` · ${mentorship.mentee.chapter.name}` : ""
      }`}
      focus={calmFocus}
      goals={calmGoals}
      goalsEmpty="No active G&R goals tracked yet."
      commitments={[]}
      commitmentsEmpty="Action items live in the mentee workspace."
    />
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Mentorship relationship</p>
          <h1 className="page-title">{mentorship.mentee.name}</h1>
          <p className="page-subtitle">
            Mentor: {mentorship.mentor.name} · {mentorship.mentee.primaryRole}
            {mentorship.mentee.chapter
              ? ` · ${mentorship.mentee.chapter.name}`
              : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`pill ${statusToneClass}`}>{mentorship.status}</span>
          <Link
            href={`/mentorship/mentees/${mentorship.menteeId}`}
            className="button secondary small"
          >
            Open mentee workspace →
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CalmOnly>{calmSummary}</CalmOnly>
      </div>

      <CalmCollapse
        label="Open the full record"
        hint="reassign / status controls, sessions, reviews, and operations"
      >
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="card">
          <p className="kpi" style={{ color: isOverdueCheckIn ? "#d97706" : undefined }}>
            {latestActivity
              ? new Date(latestActivity).toLocaleDateString()
              : "—"}
          </p>
          <p className="kpi-label">Last completed activity</p>
        </div>
        <div className="card">
          <p className="kpi">{mentorship.checkIns.length}</p>
          <p className="kpi-label">Recent check-ins (latest 5)</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: stalledGoals.length > 0 ? "#d97706" : undefined }}>
            {grDoc ? grDoc.goals.length : 0}
          </p>
          <p className="kpi-label">G&amp;R goals tracked</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: stalledGoals.length > 0 ? "#d97706" : undefined }}>
            {stalledGoals.length}
          </p>
          <p className="kpi-label">Stalled / overdue goals</p>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Reassign mentor
          </div>
          <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
            Ends the current mentorship and creates a fresh one with the new
            mentor. The previous mentor&apos;s circle role is deactivated and
            the change is recorded in the audit log.
          </p>
          <form action={reassignProgramMentor} className="form-grid">
            <input type="hidden" name="mentorshipId" value={mentorship.id} />
            <div className="form-row">
              <label>New mentor</label>
              <select name="newMentorId" className="input" required>
                <option value="">Select mentor…</option>
                {eligibleMentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name} ({mentor.primaryRole})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Reason (optional)</label>
              <textarea
                name="reason"
                className="input"
                rows={3}
                placeholder="Why is this mentee being reassigned?"
              />
            </div>
            <button
              type="submit"
              className="button primary small"
              disabled={mentorship.status !== "ACTIVE"}
            >
              Reassign mentor
            </button>
          </form>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              Status
            </div>
            <span className={`pill pill-small ${statusToneClass}`}>
              Currently {mentorship.status}
            </span>
          </div>
          <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
            Pause when the relationship is on hold but not ending. Mark
            complete when the engagement is closed. Reactivate to resume from
            paused. Saving without changing the status is a no-op.
          </p>
          <form
            action={setProgramMentorshipStatus}
            className="form-grid"
            style={{ marginBottom: 12 }}
          >
            <input type="hidden" name="mentorshipId" value={mentorship.id} />
            <div className="form-row">
              <label>New status</label>
              <select
                name="status"
                className="input"
                defaultValue={mentorship.status}
              >
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETE">Complete</option>
              </select>
            </div>
            <div className="form-row">
              <label>Note (optional)</label>
              <textarea
                name="reason"
                className="input"
                rows={2}
                placeholder="Internal note for audit log."
              />
            </div>
            <button type="submit" className="button secondary small">
              Update status
            </button>
          </form>
          {isOverdueCheckIn ? (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                background: "#fffbeb",
                borderLeft: "3px solid #d97706",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                color: "#78350f",
              }}
            >
              No completed session in the last {STALE_SESSION_DAYS} days. Consider
              following up with the mentor or pausing this relationship.
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Recent sessions
          </div>
          {mentorship.sessions.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No sessions logged yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {mentorship.sessions.map((session) => (
                <li
                  key={session.id}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <strong>{session.title}</strong>
                  <div style={{ color: "var(--muted)" }}>
                    {session.type} ·{" "}
                    {session.completedAt
                      ? `Completed ${new Date(session.completedAt).toLocaleDateString()}`
                      : `Scheduled ${new Date(session.scheduledAt).toLocaleDateString()}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Recent check-ins
          </div>
          {mentorship.checkIns.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No check-ins logged.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {mentorship.checkIns.map((checkIn) => (
                <li
                  key={checkIn.id}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: "var(--muted)", marginBottom: 4 }}>
                    {new Date(checkIn.createdAt).toLocaleDateString()}
                    {checkIn.rating != null ? ` · rating ${checkIn.rating}/5` : ""}
                  </div>
                  <div>{checkIn.notes.slice(0, 240)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Goals & Resources snapshot
          </div>
          {!grDoc ? (
            <p style={{ color: "var(--muted)" }}>
              No active G&amp;R document.{" "}
              <Link
                href={`/mentorship/mentees/${mentorship.menteeId}`}
                className="link"
              >
                Open mentee workspace →
              </Link>
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {grDoc.goals.map((goal) => {
                const overdue =
                  goal.lifecycleStatus === "ACTIVE" &&
                  goal.dueDate &&
                  goal.dueDate < now &&
                  goal.progressState !== "DONE";
                return (
                  <li
                    key={goal.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                      color: overdue ? "#92400e" : undefined,
                    }}
                  >
                    <strong>{goal.title}</strong>
                    <div style={{ color: "var(--muted)" }}>
                      {goal.progressState.replace(/_/g, " ")} ·{" "}
                      {goal.lifecycleStatus.toLowerCase()}
                      {goal.dueDate
                        ? ` · due ${new Date(goal.dueDate).toLocaleDateString()}`
                        : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Recent goal reviews
          </div>
          {mentorship.goalReviews.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No goal reviews yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {mentorship.goalReviews.map((review) => (
                <li
                  key={review.id}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <strong>
                    {new Date(review.cycleMonth).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                    })}
                  </strong>
                  <div style={{ color: "var(--muted)" }}>
                    {review.status.replace(/_/g, " ")} · rating{" "}
                    {review.overallRating}
                    {review.chairApprovedAt
                      ? ` · approved ${new Date(review.chairApprovedAt).toLocaleDateString()}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>
          Support circle
        </div>
        {mentorship.circleMembers.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No active support circle members.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {mentorship.circleMembers.map((member) => (
              <li key={member.id}>
                <span className="pill pill-small">
                  {member.user.name} · {member.role.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {operationsEnabled && opsContext ? (
        <div style={{ marginTop: 16 }}>
          <OperationalContextPanel
            title="Mentorship Operations"
            health={opsContext.health}
            meetings={opsContext.meetings}
            actions={opsContext.actions}
            openFollowUps={opsContext.openFollowUps}
            recentDecisions={opsContext.recentDecisions}
            canCreate={canCreateAction(viewer)}
            createActionHref={`/actions/new?relatedType=MENTORSHIP&relatedId=${mentorship.id}`}
            createMeetingHref={`/actions/meetings?new=1&relatedType=MENTORSHIP&relatedId=${mentorship.id}`}
            emptyActionsHint="No Action Tracker items are linked to this mentorship yet."
            emptyMeetingsHint="This mentorship hasn't been discussed in a tracked meeting yet."
          />
          {isStrategicInitiativesEnabled() ? (
            <div style={{ marginTop: 14 }}>
              <StrategicEntityPanel
                context={deriveStrategicEntityContext({
                  actions: opsContext.actions,
                  meetings: opsContext.meetings,
                })}
              />
            </div>
          ) : null}
          <div style={{ marginTop: 14 }}>
            <OperationalTimeline
              events={deriveOperationalTimeline({
                meetings: opsContext.meetings,
                actions: opsContext.actions,
                decisions: opsContext.recentDecisions,
                followUps: opsContext.openFollowUps,
              })}
              compact
              createActionHref={`/actions/new?relatedType=MENTORSHIP&relatedId=${mentorship.id}`}
              createMeetingHref={`/actions/meetings?new=1&relatedType=MENTORSHIP&relatedId=${mentorship.id}`}
            />
          </div>
        </div>
      ) : null}
      </CalmCollapse>
    </div>
  );
}
