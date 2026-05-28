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
import MatchingPanel from "@/app/(app)/admin/mentorship-program/matching-panel";
import MenteeMatchingBoard from "@/app/(app)/admin/mentorship-program/mentee-matching-board";
import AnalyticsPanel from "@/app/(app)/admin/mentorship-program/analytics-panel";
import GRTemplateListPanel from "@/components/gr/gr-template-list-panel";
import GRResourceLibraryPanel from "@/components/gr/gr-resource-library-panel";
import GRAssignmentsPanel from "@/components/gr/gr-assignments-panel";
import {
  ADMIN_MENTORSHIP_LANE_META,
  ADMIN_MENTORSHIP_LANES,
  SHOW_STUDENT_MENTORSHIP_LANE,
  parseAdminMentorshipLane,
  toLaneQueryValue,
} from "@/lib/mentorship-admin-helpers";
import { FULL_PROGRAM_MENTOR_CAP } from "@/lib/mentorship-canonical";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import {
  getGRAssignedDocuments,
  getGRGoalChangeQueue,
  getGRResourceLibrary,
  getGRTemplates,
} from "@/lib/gr-actions";
import { getMentorEffectivenessScores } from "@/lib/mentor-effectiveness";
import { getProgramAnalytics } from "@/lib/mentorship-overview-actions";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { ActionSummaryHeader } from "@/components/mentorship/action-summary-header";
import {
  getAdminMentorshipActionQueue,
  getInstructorMentorshipOpsSummary,
  getMentorWorkload,
  getUnassignedInstructorQueue,
} from "@/lib/instructor-mentorship-ops";

export const ADMIN_MENTORSHIP_PAGE_TITLE = "Instructor Mentorship Oversight";

export const metadata = { title: "Instructor Mentorship Admin — YPP Portal" };

const TABS = [
  { key: "overview", label: "Overview / Pulse" },
  { key: "needs-attention", label: "Needs Attention" },
  { key: "assignments", label: "Assignments" },
  { key: "capacity", label: "Capacity / Workload" },
  { key: "approvals", label: "Approvals" },
  { key: "templates", label: "Goals & Resources" },
  { key: "committees", label: "Committees & Chairs" },
  { key: "analytics", label: "Analytics" },
] as const;

type Tab = (typeof TABS)[number]["key"];
type SearchParams = {
  tab?: string;
  lane?: string;
  menteeId?: string;
  supportRole?: string;
};
type MatchSupportRole =
  | "PRIMARY_MENTOR"
  | "CHAIR"
  | "SPECIALIST_MENTOR"
  | "COLLEGE_ADVISOR"
  | "ALUMNI_ADVISOR";

function parseTab(raw?: string): Tab {
  if (
    raw === "overview" ||
    raw === "needs-attention" ||
    raw === "assignments" ||
    raw === "capacity" ||
    raw === "approvals" ||
    raw === "templates" ||
    raw === "committees" ||
    raw === "analytics"
  ) {
    return raw;
  }
  if (raw === "pulse") return "overview";
  if (raw === "needs-action" || raw === "check-ins") return "needs-attention";
  if (raw === "unassigned" || raw === "matching" || raw === "pairings") {
    return "assignments";
  }
  if (raw === "workload") return "capacity";
  if (raw === "gr" || raw === "goals") return "templates";
  return "overview";
}

function parseSupportRole(raw?: string): MatchSupportRole {
  if (
    raw === "PRIMARY_MENTOR" ||
    raw === "CHAIR" ||
    raw === "SPECIALIST_MENTOR" ||
    raw === "COLLEGE_ADVISOR" ||
    raw === "ALUMNI_ADVISOR"
  ) {
    return raw;
  }

  return "PRIMARY_MENTOR";
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

  const overCapacityMentors = mentorCapacityWarnings.filter(
    (m) => m.mentorPairs.length > FULL_PROGRAM_MENTOR_CAP
  );

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

async function getGRAdminData() {
  const [templates, resources, documents, goalChanges] = await Promise.all([
    getGRTemplates(),
    getGRResourceLibrary(),
    getGRAssignedDocuments(),
    getGRGoalChangeQueue(),
  ]);

  return {
    templates: templates.map((t) => ({
      id: t.id,
      title: t.title,
      roleType: t.roleType,
      officerPosition: t.officerPosition,
      status: t.status,
      version: t.version,
      publishedAt: t.publishedAt?.toISOString() ?? null,
      goalCount: t.goals.length,
      assignmentCount: t._count.assignments,
      commentCount: t._count.comments,
      updatedAt: t.updatedAt.toISOString(),
    })),
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
      isUpload: r.isUpload,
      tags: r.tags,
      createdAt: r.createdAt.toISOString(),
    })),
    documents: documents.map((d) => ({
      id: d.id,
      userName: d.user.name,
      userEmail: d.user.email,
      templateTitle: d.template.title,
      roleType: d.template.roleType,
      mentorName: d.mentorship.mentor.name,
      status: d.status,
      goalCount: d._count.goals,
      pendingChanges: d._count.goalChanges,
      createdAt: d.createdAt.toISOString(),
    })),
    goalChanges: goalChanges.map((gc) => ({
      id: gc.id,
      documentId: gc.documentId,
      userName: gc.document.user.name,
      templateTitle: gc.document.template.title,
      proposedByName: gc.proposedBy.name,
      changeType: gc.changeType,
      proposedData: gc.proposedData as Record<string, string>,
      reason: gc.reason,
      createdAt: gc.createdAt.toISOString(),
    })),
    templateOptions: templates.map((t) => ({
      id: t.id,
      title: t.title,
      roleType: t.roleType,
      status: t.status,
    })),
  };
}

export default async function AdminMentorshipPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const tab = parseTab(searchParams.tab);
  const lane = parseAdminMentorshipLane(searchParams.lane);
  const supportRole = parseSupportRole(searchParams.supportRole);

  const [data, goalReviews, monthlyReviews, opsSummary] = await Promise.all([
    getAdminMentorshipCommandCenterData(),
    tab === "approvals" ? getMentorshipGoalReviews() : Promise.resolve([]),
    tab === "approvals" ? getMentorshipMonthlyReviews() : Promise.resolve([]),
    tab === "overview" || tab === "needs-attention"
      ? getInstructorMentorshipOpsSummary()
      : Promise.resolve(null),
  ]);

  const pulseData = tab === "overview" ? await getPulseData() : null;
  const needsActionItems =
    tab === "needs-attention" ? await getAdminMentorshipActionQueue() : null;
  const unassignedQueue =
    tab === "assignments" ? await getUnassignedInstructorQueue() : null;
  const workloadRows = tab === "capacity" ? await getMentorWorkload() : null;
  const grData = tab === "templates" ? await getGRAdminData() : null;
  const [programAnalytics, mentorScores] =
    tab === "analytics"
      ? await Promise.all([getProgramAnalytics(), getMentorEffectivenessScores()])
      : [null, []];

  const laneMeta = ADMIN_MENTORSHIP_LANE_META[lane];
  const selectedSummary =
    data.laneSummaries.find((summary) => summary.lane === lane) ??
    data.laneSummaries[0];
  const laneCircles = data.circleSummaries.filter((circle) => circle.lane === lane);
  const laneUnassigned = data.unassignedMentees.filter(
    (mentee) => mentee.lane === lane
  );

  const unassignedCount = data.unassignedMentees.length;

  return (
    <div>
      <ActionSummaryHeader
        badge="Admin · Instructor Mentorship"
        title={ADMIN_MENTORSHIP_PAGE_TITLE}
        purpose="One command center for program health, assignments, capacity, approvals, G&R, committees, and analytics."
        status={
          unassignedCount > 0
            ? { label: `${unassignedCount} mentee(s) awaiting a mentor`, tone: "pending" }
            : { label: "Every active mentee has a mentor", tone: "success" }
        }
        nextAction={{
          label: "Review what needs attention →",
          href: "/admin/mentorship?tab=needs-attention",
        }}
        secondaryAction={{
          label: "Open Assignments →",
          href: "/admin/mentorship?tab=assignments",
        }}
      />

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

      {/* ── Overview / Pulse tab ─────────────────── */}
      {tab === "overview" && pulseData && (
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
              <p className="kpi-label">Mentees without a mentor</p>
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
            <Link href="/admin/mentorship?tab=needs-attention" className="button primary small">
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
                  "BEHIND_SCHEDULE",
                  "GETTING_STARTED",
                  "ACHIEVED",
                  "ABOVE_AND_BEYOND",
                ].map((key) => {
                  const ratingCopy = getGoalRatingCopy(key);
                  const count = pulseData.ratingMap[key] ?? 0;
                  const pct = Math.round((count / pulseData.total) * 100);
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span>{ratingCopy.shortLabel} - {ratingCopy.label}</span>
                        <span style={{ color: "var(--muted)" }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: ratingCopy.color, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--color-primary)", fontWeight: 600 }}>
                What the colors mean &amp; what action each calls for
              </summary>
              <div style={{ marginTop: 10 }}>
                <RatingLegend audience="admin" />
              </div>
            </details>
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

      {/* ── Needs Attention tab ──────────────────── */}
      {tab === "needs-attention" && needsActionItems && (
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

      {/* ── Assignments tab ─────────────────────── */}
      {tab === "assignments" && unassignedQueue && (
        <div style={{ display: "grid", gap: 24 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Assignment board
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              One place for primary mentor gaps, support-circle gaps, and
              shortlist decisions. The visible lanes still exclude student
              mentorship until the existing launch gate is enabled.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {ADMIN_MENTORSHIP_LANES.map((laneOption) => {
              const summary =
                data.laneSummaries.find((item) => item.lane === laneOption) ??
                selectedSummary;
              const isSelected = laneOption === lane;

              return (
                <Link
                  key={laneOption}
                  href={`/admin/mentorship?tab=assignments&lane=${toLaneQueryValue(
                    laneOption
                  )}`}
                  className="card"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    border: isSelected
                      ? "1px solid rgba(59, 130, 246, 0.35)"
                      : "1px solid var(--border)",
                    boxShadow: isSelected
                      ? "0 0 0 3px rgba(59, 130, 246, 0.08)"
                      : "none",
                    background: isSelected ? "rgba(59, 130, 246, 0.04)" : "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <strong>{ADMIN_MENTORSHIP_LANE_META[laneOption].label}</strong>
                    {isSelected ? (
                      <span className="pill pill-small">Current lane</span>
                    ) : null}
                  </div>
                  <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
                    {ADMIN_MENTORSHIP_LANE_META[laneOption].staffingExpectation}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <div>
                      <strong style={{ color: "var(--foreground)" }}>
                        {summary.activeCircles}
                      </strong>{" "}
                      active circles
                    </div>
                    <div>
                      <strong style={{ color: "var(--foreground)" }}>
                        {summary.peopleNeedingPrimaryMentor}
                      </strong>{" "}
                      unstaffed
                    </div>
                    <div>
                      <strong style={{ color: "var(--foreground)" }}>
                        {summary.staffingGaps}
                      </strong>{" "}
                      staffing gaps
                    </div>
                    <div>
                      <strong style={{ color: "var(--foreground)" }}>
                        {summary.openRequests}
                      </strong>{" "}
                      open requests
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <section>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>
                {laneMeta.label} overview
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Scan who needs a primary mentor, who already has one, and which
                circles still have coverage gaps.
              </p>
            </div>
            <MenteeMatchingBoard
              unassigned={laneUnassigned.map((m) => ({
                id: m.id,
                status: "UNASSIGNED",
                name: m.name,
                email: m.email,
                primaryRole: m.primaryRole,
                lane,
                chapterName: m.chapterName,
              }))}
              matched={laneCircles.map((c) => ({
                id: c.menteeId,
                status: "HAS_MENTOR",
                name: c.menteeName,
                email: c.menteeEmail,
                primaryRole: c.menteeRole,
                lane,
                chapterName: c.chapterName,
                mentorName: c.mentorName,
                mentorshipId: c.mentorshipId,
                circleGaps: c.missingRoles,
              }))}
              lane={toLaneQueryValue(lane)}
            />
          </section>

          <section>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>
                Shortlist matching
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Reuses the existing matching logic to compare fit, load, chapter
                affinity, and support-circle context before approving an assignment.
              </p>
            </div>
            <MatchingPanel
              key={`${lane}-${supportRole}-${searchParams.menteeId ?? "all"}`}
              initialLane={lane}
              initialSupportRole={supportRole}
              initialMenteeId={searchParams.menteeId}
              autoRun={Boolean(searchParams.menteeId)}
            />
          </section>

          <section>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Mentees waiting for a mentor ({unassignedQueue.length})
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Instructors and leadership users with no current mentorship
                pairing. Use Assign mentor to open the shortlist pre-filtered
                for that mentee.
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
                Every eligible mentee already has a mentor. Nothing to do here.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Mentee</th>
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
                          href={`/admin/mentorship?tab=assignments&menteeId=${row.id}&supportRole=PRIMARY_MENTOR`}
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
          </section>
        </div>
      )}

      {/* ── Capacity / workload tab ─────────────── */}
      {tab === "capacity" && workloadRows && (
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

      {/* ── Goals & Resources tab ────────────────── */}
      {tab === "templates" && grData && (
        <div style={{ display: "grid", gap: 24 }}>
          <section
            className="card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              borderLeft: "3px solid var(--color-primary)",
            }}
          >
            <div>
              <strong>Need the full G&amp;R workspace?</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                The canonical Goals &amp; Resources area lists every document by
                owner and mentor, flags stale drafts and overdue goals, and lets
                you open any single document for detail.
              </p>
            </div>
            <Link href="/admin/mentorship/gr" className="button primary small">
              Open Goals &amp; Resources →
            </Link>
          </section>

          <section className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Role Goal Templates</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Default mentorship-program goals by lane. Mentors can adjust
              targets monthly; chairs and admins keep the templates aligned.
            </p>
            <GoalsPanel goals={data.goals} />
          </section>

          <section className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>G&amp;R Templates</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Create and manage Goals &amp; Responsibilities templates without
              leaving the mentorship command center.
            </p>
            <GRTemplateListPanel templates={grData.templates} />
          </section>

          <section className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>G&amp;R Assignments</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Assign G&amp;R documents and review goal-change proposals for
              active mentorships.
            </p>
            <GRAssignmentsPanel
              documents={grData.documents}
              goalChanges={grData.goalChanges}
              templates={grData.templateOptions}
            />
          </section>

          <section className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>G&amp;R Resource Library</div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Shared resources for G&amp;R documents, templates, and mentor
              recommendations.
            </p>
            <GRResourceLibraryPanel resources={grData.resources} />
          </section>
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

      {/* ── Analytics tab ────────────────────────── */}
      {tab === "analytics" && programAnalytics && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Mentorship analytics
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              Program-wide review pipeline, points, tier distribution,
              nominations, recent approvals, and mentor effectiveness.
            </p>
          </div>
          <AnalyticsPanel analytics={programAnalytics} mentorScores={mentorScores} />
        </div>
      )}
    </div>
  );
}
