import Link from "next/link";
import { redirect } from "next/navigation";
import { MentorshipType } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getAdminMentorshipCommandCenterData } from "@/lib/admin-mentorship-command-center";
import {
  getMentorshipGoalReviews,
  getMentorshipMonthlyReviews,
} from "@/lib/mentorship-kanban-actions";
import GoalReviewsBoard from "@/app/(app)/admin/mentorship-program/goal-reviews-board";
import ReviewApprovalsBoard from "@/app/(app)/admin/mentorship-program/review-approvals-board";
import GoalsPanel from "@/app/(app)/admin/mentorship-program/goals-panel";
import ChairsPanel from "@/app/(app)/admin/mentorship-program/chairs-panel";
import { SHOW_STUDENT_MENTORSHIP_LANE } from "@/lib/mentorship-admin-helpers";
import {
  getAdminMentorshipActionQueue,
  getInstructorMentorshipOpsSummary,
  getMentorWorkload,
  getOverdueCheckInQueue,
  getStalledGoalQueue,
  getUnassignedInstructorQueue,
} from "@/lib/instructor-mentorship-ops";

export const metadata = { title: "Instructor Mentorship Admin — YPP Portal" };

const TABS = [
  { key: "pulse", label: "Pulse" },
  { key: "needs-action", label: "Needs Action" },
  { key: "unassigned", label: "Unassigned" },
  { key: "workload", label: "Workload" },
  { key: "gr", label: "G&R" },
  { key: "check-ins", label: "Check-ins" },
  { key: "approvals", label: "Approvals" },
  { key: "pairings", label: "Pairings" },
  { key: "goals", label: "Goals" },
  { key: "committees", label: "Committees" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function parseTab(raw?: string): Tab {
  if (
    raw === "needs-action" ||
    raw === "unassigned" ||
    raw === "workload" ||
    raw === "gr" ||
    raw === "check-ins" ||
    raw === "approvals" ||
    raw === "pairings" ||
    raw === "goals" ||
    raw === "committees"
  ) {
    return raw;
  }
  return "pulse";
}

// Match the lane filter on `lib/admin-mentorship-command-center.ts`:
// student mentorship is hidden until launch, so we exclude STUDENT-typed
// mentorships from every pulse metric.
const MENTORSHIP_TYPE_FILTER = SHOW_STUDENT_MENTORSHIP_LANE
  ? undefined
  : { not: MentorshipType.STUDENT };

async function getPulseData() {
  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    activeCount,
    pendingChairCount,
    reflectionsDueCount,
    reflectionsSubmittedCount,
    ratingBreakdown,
    mentorCapacityWarnings,
  ] = await Promise.all([
    prisma.mentorship.count({
      where: { status: "ACTIVE", type: MENTORSHIP_TYPE_FILTER },
    }),
    prisma.mentorGoalReview.count({
      where: {
        status: "PENDING_CHAIR_APPROVAL",
        mentorship: { type: MENTORSHIP_TYPE_FILTER },
      },
    }),
    prisma.mentorship.count({
      where: {
        status: "ACTIVE",
        cycleStage: "REFLECTION_DUE",
        type: MENTORSHIP_TYPE_FILTER,
      },
    }),
    prisma.monthlySelfReflection.count({
      where: {
        cycleMonth: { gte: cycleStart },
        mentorship: { type: MENTORSHIP_TYPE_FILTER },
      },
    }),
    prisma.goalReviewRating.groupBy({
      by: ["rating"],
      _count: true,
      where: {
        review: {
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) },
          status: "APPROVED",
          mentorship: { type: MENTORSHIP_TYPE_FILTER },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { roles: { some: { role: "MENTOR" } } },
          { mentorPairs: { some: { status: "ACTIVE" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        mentorPairs: {
          where: { status: "ACTIVE", type: MENTORSHIP_TYPE_FILTER },
          select: { id: true },
        },
      },
    }),
  ]);

  const ratingMap: Record<string, number> = {};
  for (const row of ratingBreakdown) {
    ratingMap[row.rating] = row._count;
  }

  const total = Object.values(ratingMap).reduce((a, b) => a + b, 0);
  const fairnessWarning =
    total > 0 &&
    ((ratingMap["ABOVE_AND_BEYOND"] ?? 0) / total > 0.4 ||
      (ratingMap["BEHIND_SCHEDULE"] ?? 0) / total > 0.5);

  const overCapacityMentors = mentorCapacityWarnings.filter((m) => m.mentorPairs.length > 3);

  return {
    activeCount,
    pendingChairCount,
    reflectionsDueCount,
    reflectionsSubmittedCount,
    ratingMap,
    total,
    fairnessWarning,
    overCapacityMentors,
    completionRate:
      activeCount > 0
        ? Math.round((reflectionsSubmittedCount / activeCount) * 100)
        : 0,
  };
}

async function getPairingsData() {
  // Anyone with the MENTOR role *or* who currently has an active mentee
  // counts here — instructors mentoring instructors is a launch use case
  // and they may not also carry the explicit MENTOR role.
  const mentors = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "MENTOR" } } },
        { mentorPairs: { some: { status: "ACTIVE" } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      mentorPairs: {
        where: { status: "ACTIVE", type: MENTORSHIP_TYPE_FILTER },
        select: {
          id: true,
          cycleStage: true,
          mentee: { select: { name: true, primaryRole: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return mentors
    .filter((m) => m.mentorPairs.length > 0)
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.email,
      menteeCount: m.mentorPairs.length,
      mentees: m.mentorPairs.map((link) => ({
        name: link.mentee.name ?? "",
        role: link.mentee.primaryRole ?? "",
        stage: link.cycleStage,
      })),
      isAtCapacity: m.mentorPairs.length >= 3,
      isOverCapacity: m.mentorPairs.length > 3,
    }));
}

export default async function AdminMentorshipPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const tab = parseTab(searchParams.tab);

  const [data, goalReviews, monthlyReviews, opsSummary] = await Promise.all([
    getAdminMentorshipCommandCenterData(),
    tab === "approvals" ? getMentorshipGoalReviews() : Promise.resolve([]),
    tab === "approvals" ? getMentorshipMonthlyReviews() : Promise.resolve([]),
    tab === "pulse" || tab === "needs-action"
      ? getInstructorMentorshipOpsSummary()
      : Promise.resolve(null),
  ]);

  const pulseData = tab === "pulse" ? await getPulseData() : null;
  const pairingsData = tab === "pairings" ? await getPairingsData() : null;
  const needsActionItems =
    tab === "needs-action" ? await getAdminMentorshipActionQueue() : null;
  const unassignedQueue =
    tab === "unassigned" ? await getUnassignedInstructorQueue() : null;
  const workloadRows = tab === "workload" ? await getMentorWorkload() : null;
  const stalledGoals = tab === "gr" ? await getStalledGoalQueue() : null;
  const overdueCheckIns =
    tab === "check-ins" ? await getOverdueCheckInQueue() : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Instructor Mentorship</p>
          <h1 className="page-title">Instructor Mentorship Oversight</h1>
          <p className="page-subtitle">
            Program health, approvals, pairings, goals, and committees for the
            instructor mentorship program.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/mentorship-program" className="button secondary small">
            Full Command Center →
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/mentorship?tab=${t.key}`}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "var(--color-primary)" : "var(--muted)",
              borderBottom: tab === t.key ? "2px solid var(--color-primary)" : "2px solid transparent",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Pulse tab ─────────────────────────────── */}
      {tab === "pulse" && pulseData && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div className="card">
              <p className="kpi">{pulseData.activeCount}</p>
              <p className="kpi-label">Active instructor mentorships</p>
            </div>
            <div className="card">
              <p
                className="kpi"
                style={{
                  color:
                    (opsSummary?.unassignedInstructors ?? 0) > 0
                      ? "#d97706"
                      : undefined,
                }}
              >
                {opsSummary?.unassignedInstructors ?? 0}
              </p>
              <p className="kpi-label">Instructors without a mentor</p>
            </div>
            <div className="card">
              <p
                className="kpi"
                style={{
                  color:
                    (opsSummary?.overdueCheckIns ?? 0) > 0
                      ? "#d97706"
                      : undefined,
                }}
              >
                {opsSummary?.overdueCheckIns ?? 0}
              </p>
              <p className="kpi-label">Overdue check-ins</p>
            </div>
            <div className="card">
              <p
                className="kpi"
                style={{
                  color:
                    (opsSummary?.stalledGoals ?? 0) > 0
                      ? "#d97706"
                      : undefined,
                }}
              >
                {opsSummary?.stalledGoals ?? 0}
              </p>
              <p className="kpi-label">Stalled goals</p>
            </div>
            <div className="card">
              <p className="kpi" style={{ color: pulseData.pendingChairCount > 0 ? "#d97706" : undefined }}>
                {pulseData.pendingChairCount}
              </p>
              <p className="kpi-label">Pending chair approval</p>
            </div>
            <div className="card">
              <p className="kpi" style={{ color: pulseData.reflectionsDueCount > 0 ? "#d97706" : undefined }}>
                {pulseData.reflectionsDueCount}
              </p>
              <p className="kpi-label">Reflections overdue</p>
            </div>
            <div className="card">
              <p className="kpi">{pulseData.completionRate}%</p>
              <p className="kpi-label">Reflection completion this cycle</p>
            </div>
            <div className="card">
              <p
                className="kpi"
                style={{
                  color:
                    (opsSummary?.mentorsOverCapacity ?? 0) > 0
                      ? "#ef4444"
                      : (opsSummary?.mentorsAtOrOverCapacity ?? 0) > 0
                      ? "#d97706"
                      : undefined,
                }}
              >
                {opsSummary?.mentorsAtOrOverCapacity ?? 0}
              </p>
              <p className="kpi-label">
                Mentors at / over capacity (3+)
              </p>
            </div>
          </div>

          <div
            className="card"
            style={{
              marginBottom: 20,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>Need a single action queue?</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                The Needs Action tab combines unassigned instructors, overdue
                check-ins, stalled goals, and pending reviews in priority order.
              </p>
            </div>
            <Link href="/admin/mentorship?tab=needs-action" className="button primary small">
              Open Needs Action queue →
            </Link>
          </div>

          {/* Rating distribution fairness check */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: pulseData.fairnessWarning ? 8 : 12 }}>
              Rating Distribution (last 3 months)
            </div>
            {pulseData.fairnessWarning && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fef9c3",
                  borderLeft: "3px solid #ca8a04",
                  borderRadius: "var(--radius-md)",
                  marginBottom: 12,
                  fontSize: 13,
                  color: "#78350f",
                }}
              >
                Fairness check: distribution looks skewed. High Above & Beyond or Behind rates
                may indicate inflated or overly harsh scoring. Review mentor patterns.
              </div>
            )}
            {pulseData.total === 0 ? (
              <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>No approved ratings in the last 3 months.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { key: "BEHIND_SCHEDULE", label: "Red — Behind Schedule", color: "#ef4444" },
                  { key: "GETTING_STARTED", label: "Yellow — Getting Started", color: "#f59e0b" },
                  { key: "ACHIEVED", label: "Green — Achieved", color: "#22c55e" },
                  { key: "ABOVE_AND_BEYOND", label: "Purple — Above & Beyond", color: "#a855f7" },
                ].map(({ key, label, color }) => {
                  const count = pulseData.ratingMap[key] ?? 0;
                  const pct = Math.round((count / pulseData.total) * 100);
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span>{label}</span>
                        <span style={{ color: "var(--muted)" }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pulseData.overCapacityMentors.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#ef4444" }}>
                Over-Capacity Mentors
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
                These mentors have more than 3 active mentees. Consider redistributing.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pulseData.overCapacityMentors.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.6rem 0.8rem",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        background: "#ef4444",
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      {m.mentorPairs.length} mentees
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Needs Action tab ─────────────────────── */}
      {tab === "needs-action" && needsActionItems && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Items needing admin attention ({needsActionItems.length})
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              Sorted by urgency. Top items: instructors without a mentor, then
              relationships missing a Goals & Resources doc, overdue check-ins,
              stalled goals, and pending chair approvals.
            </p>
          </div>
          {needsActionItems.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              Nothing needs admin attention right now. Nice work.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {needsActionItems.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    borderLeft:
                      item.kind === "UNASSIGNED_INSTRUCTOR"
                        ? "3px solid #ef4444"
                        : item.kind === "NO_GOALS"
                        ? "3px solid #d97706"
                        : item.kind === "OVERDUE_CHECK_IN"
                        ? "3px solid #f59e0b"
                        : item.kind === "STALLED_GOAL"
                        ? "3px solid #f59e0b"
                        : "3px solid #3b82f6",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <strong>{item.title}</strong>
                    <p style={{ margin: "6px 0 8px", color: "var(--muted)", fontSize: 13 }}>
                      {item.detail}
                    </p>
                    <span className="pill pill-small">{item.kind.replace(/_/g, " ")}</span>
                  </div>
                  <div style={{ alignSelf: "center" }}>
                    <Link href={item.href} className="button primary small">
                      {item.emphasis}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Unassigned instructors tab ──────────── */}
      {tab === "unassigned" && unassignedQueue && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Instructors waiting for a mentor ({unassignedQueue.length})
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              Active instructors with no current mentorship pairing. Use the
              Assign action to open the matching panel pre-filtered for that
              instructor.
            </p>
          </div>
          {unassignedQueue.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              All active instructors are mentored. Nothing to do here.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th>Chapter</th>
                  <th>Joined</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unassignedQueue.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {row.email}
                      </div>
                    </td>
                    <td>{row.chapterName ?? "—"}</td>
                    <td>{new Date(row.joinedAt).toLocaleDateString()}</td>
                    <td>{row.reason}</td>
                    <td>
                      <Link
                        href={`/admin/mentorship-program?focus=matching&menteeId=${row.id}&supportRole=PRIMARY_MENTOR`}
                        className="button primary small"
                      >
                        Assign mentor
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Mentor workload tab ─────────────────── */}
      {tab === "workload" && workloadRows && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Mentor workload ({workloadRows.length})
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              Active mentees per mentor, plus overdue check-in count, stalled
              goal count, and last activity timestamp. Soft cap is 3 mentees.
            </p>
          </div>
          {workloadRows.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              No mentors with active assignments yet.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Active mentees</th>
                  <th>Overdue check-ins</th>
                  <th>Stalled goals</th>
                  <th>Last activity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workloadRows.map((row) => (
                  <tr
                    key={row.id}
                    style={
                      row.isOverCapacity
                        ? { background: "#fef2f2" }
                        : row.isAtCapacity
                        ? { background: "#fffbeb" }
                        : undefined
                    }
                  >
                    <td>
                      <strong>{row.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {row.email}
                      </div>
                    </td>
                    <td>
                      {row.activeMenteeCount} / {row.capacity}
                    </td>
                    <td
                      style={{
                        color: row.overdueCheckIns > 0 ? "#d97706" : undefined,
                      }}
                    >
                      {row.overdueCheckIns}
                    </td>
                    <td
                      style={{
                        color: row.stalledGoals > 0 ? "#d97706" : undefined,
                      }}
                    >
                      {row.stalledGoals}
                    </td>
                    <td>
                      {row.lastActivityAt
                        ? new Date(row.lastActivityAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      {row.warning ? (
                        <span
                          className={`pill pill-small ${
                            row.isOverCapacity ? "pill-declined" : "pill-pending"
                          }`}
                        >
                          {row.warning}
                        </span>
                      ) : (
                        <span className="pill pill-small pill-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── G&R oversight tab ──────────────────── */}
      {tab === "gr" && stalledGoals && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Stalled or overdue G&amp;R goals ({stalledGoals.length})
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              Active goals that are past due, marked blocked, or have not been
              updated in 30+ days. Sorted by due date.
            </p>
          </div>
          {stalledGoals.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              No stalled goals across active instructor mentorships.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Instructor</th>
                  <th>Mentor</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stalledGoals.map((row) => (
                  <tr key={row.goalId}>
                    <td>
                      <strong>{row.goalTitle}</strong>
                    </td>
                    <td>{row.menteeName}</td>
                    <td>{row.mentorName}</td>
                    <td>
                      <span className="pill pill-small">
                        {row.progressState.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      {row.dueDate
                        ? new Date(row.dueDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{row.reason}</td>
                    <td>
                      <Link
                        href={`/admin/mentorship/relationships/${row.mentorshipId}`}
                        className="button secondary small"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Check-in oversight tab ─────────────── */}
      {tab === "check-ins" && overdueCheckIns && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Overdue check-ins ({overdueCheckIns.length})
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              Active mentorships with no completed session in the last 30 days
              and no upcoming scheduled session. Oldest start dates first.
            </p>
          </div>
          {overdueCheckIns.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              All active mentorships have a recent or upcoming session.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th>Mentor</th>
                  <th>Last activity</th>
                  <th>Days since</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {overdueCheckIns.map((row) => (
                  <tr key={row.mentorshipId}>
                    <td>
                      <strong>{row.menteeName}</strong>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {row.menteeRole.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td>{row.mentorName}</td>
                    <td>
                      {row.lastActivityAt
                        ? new Date(row.lastActivityAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td
                      style={{
                        color:
                          (row.daysSinceActivity ?? 0) > 60
                            ? "#ef4444"
                            : "#d97706",
                      }}
                    >
                      {row.daysSinceActivity ?? "—"}
                    </td>
                    <td>
                      <Link
                        href={`/admin/mentorship/relationships/${row.mentorshipId}`}
                        className="button secondary small"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Approvals tab ─────────────────────────── */}
      {tab === "approvals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Goal Reviews — Chair Approval Queue</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Drag goal reviews to Approved or Changes Requested.
            </p>
            <GoalReviewsBoard reviews={goalReviews} />
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Monthly Reviews — Chair Approval Queue</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Track monthly reviews from draft through chair approval.
            </p>
            <ReviewApprovalsBoard reviews={monthlyReviews} />
          </div>
        </div>
      )}

      {/* ── Pairings tab ──────────────────────────── */}
      {tab === "pairings" && pairingsData && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Link href="/admin/mentorship-program?focus=matching" className="button primary small">
              Open matching panel →
            </Link>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {pairingsData.length === 0 && (
              <p style={{ color: "var(--muted)" }}>No active mentors found.</p>
            )}
            {pairingsData.map((mentor) => (
              <div
                key={mentor.id}
                className="card"
                style={{
                  borderLeft: mentor.isOverCapacity
                    ? "3px solid #ef4444"
                    : mentor.isAtCapacity
                    ? "3px solid #f59e0b"
                    : "3px solid #22c55e",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <strong>{mentor.name}</strong>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 9px",
                      borderRadius: 999,
                      background: mentor.isOverCapacity ? "#fef2f2" : mentor.isAtCapacity ? "#fffbeb" : "#f0fdf4",
                      color: mentor.isOverCapacity ? "#ef4444" : mentor.isAtCapacity ? "#92400e" : "#166534",
                      fontWeight: 700,
                      border: `1px solid ${mentor.isOverCapacity ? "#fecaca" : mentor.isAtCapacity ? "#fde68a" : "#bbf7d0"}`,
                    }}
                  >
                    {mentor.menteeCount} / 3 mentees
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {mentor.mentees.map((m, i) => (
                    <span key={i} className="pill" style={{ fontSize: "0.7rem" }}>
                      {m.name || "—"} · {m.role.replace(/_/g, " ")}
                    </span>
                  ))}
                  {mentor.menteeCount === 0 && (
                    <span style={{ fontSize: "0.73rem", color: "var(--muted)", fontStyle: "italic" }}>
                      No active mentees
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Goals tab ─────────────────────────────── */}
      {tab === "goals" && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Role Goal Templates</div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
            These are the default goals shown to each mentee by role. Mentors can adjust
            targets monthly; chairs can edit these templates.
          </p>
          <GoalsPanel goals={data.goals} />
        </div>
      )}

      {/* ── Committees tab ────────────────────────── */}
      {tab === "committees" && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Committee Chairs</div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
            Each role committee has a chair who approves monthly reviews before
            they are released to mentees.
          </p>
          <ChairsPanel chairs={data.chairs} eligibleUsers={data.governanceUsers} />
        </div>
      )}
    </div>
  );
}
