import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import { getAdminMentorshipCommandCenterData } from "@/lib/admin-mentorship-command-center";
import {
  getMentorshipGoalReviews,
  getMentorshipMonthlyReviews,
} from "@/lib/mentorship-kanban-actions";
import GoalReviewsBoard from "@/app/(app)/admin/mentorship/_panels/goal-reviews-board";
import ReviewApprovalsBoard from "@/app/(app)/admin/mentorship/_panels/review-approvals-board";
import ChairsPanel from "@/app/(app)/admin/mentorship/_panels/chairs-panel";
import MatchingPanel from "@/app/(app)/admin/mentorship/_panels/matching-panel";
import MenteeMatchingBoard from "@/app/(app)/admin/mentorship/_panels/mentee-matching-board";
import AnalyticsPanel from "@/app/(app)/admin/mentorship/_panels/analytics-panel";
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
import {
  getAdminMentorshipActionQueue,
  getInstructorMentorshipOpsSummary,
  getMentorWorkload,
  getUnassignedInstructorQueue,
} from "@/lib/instructor-mentorship-ops";
import {
  ButtonLink,
  CardV2,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  RecordSection,
  StatusBadge,
  TrackerStartCard,
} from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const ADMIN_MENTORSHIP_PAGE_TITLE = "Instructor Mentorship Oversight";
export const metadata = { title: "Instructor Mentorship Admin — Pathways Portal" };

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

type PageProps = {
  searchParams: Promise<SearchParams>;
};

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

const MENTORSHIP_TYPE_FILTER = SHOW_STUDENT_MENTORSHIP_LANE
  ? undefined
  : { not: "STUDENT" as any };

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
    allPairsForStatusFiltering,
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
          { roles: { some: { role: "MENTOR" as any } } },
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
    prisma.mentorship.findMany({
      where: { type: MENTORSHIP_TYPE_FILTER },
      select: { status: true }
    }),
  ]);

  const stalledGoalsCount = allPairsForStatusFiltering.filter(
    (m: any) => String(m.status).toUpperCase() === "PENDING_GOALS"
  ).length;

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
    (m: any) => (m.mentorPairs ?? []).length > FULL_PROGRAM_MENTOR_CAP
  );

  return {
    activeCount,
    pendingChairCount,
    reflectionsDueCount,
    reflectionsSubmittedCount,
    stalledGoalsCount,
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
    getGRTemplates() ?? [],
    getGRResourceLibrary() ?? [],
    getGRAssignedDocuments() ?? [],
    getGRGoalChangeQueue() ?? [],
  ]);

  return {
    templates: (templates ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      roleType: t.roleType,
      officerPosition: t.officerPosition,
      status: t.status,
      version: t.version,
      publishedAt: t.publishedAt?.toISOString() ?? null,
      goalCount: t.goals?.length ?? 0,
      assignmentCount: t._count?.assignments ?? 0,
      commentCount: t._count?.comments ?? 0,
      updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
    })),
    resources: (resources ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
      isUpload: r.isUpload,
      tags: r.tags ?? [],
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    })),
    documents: (documents ?? []).map((d: any) => ({
      id: d.id,
      userName: d.user?.name ?? "Unknown",
      userEmail: d.user?.email ?? "",
      templateTitle: d.template?.title ?? "No Template",
      roleType: d.template?.roleType ?? "STUDENT",
      mentorName: d.mentorship?.mentor?.name ?? "Unassigned",
      status: d.status,
      goalCount: d.goals?.length ?? d._count?.goals ?? 0,
      pendingChanges: d._count?.goalChanges ?? 0,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
    })),
    goalChanges: (goalChanges ?? []).map((gc: any) => ({
      id: gc.id,
      documentId: gc.documentId,
      userName: gc.document?.user?.name ?? "Unknown",
      templateTitle: gc.document?.template?.title ?? "No Template",
      proposedByName: gc.proposedBy?.name ?? "System",
      changeType: gc.changeType,
      proposedData: (gc.proposedData as Record<string, string>) ?? {},
      reason: gc.reason,
      createdAt: gc.createdAt ? new Date(gc.createdAt).toISOString() : new Date().toISOString(),
    })),
    templateOptions: (templates ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      roleType: t.roleType,
      status: t.status,
    })),
  };
}

export default async function AdminMentorshipPage(props: PageProps) {
  const searchParams = await props.searchParams;

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
    getInstructorMentorshipOpsSummary(),
  ]);

  const pulseData = await getPulseData();
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

  const [rawChairsData, eligibleUsersData] = tab === "committees"
    ? await Promise.all([
        prisma.user.findMany({
          where: { roles: { some: {} } },
          include: { roles: true }
        }),
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
      ])
    : [[], []];

  const chairsData = (rawChairsData ?? []).filter((user: any) => 
    user.roles?.some((r: any) => String(r.role).toUpperCase() === "CHAIR" || String(r.role).toUpperCase() === "ADMIN")
  );

  const laneMeta = ADMIN_MENTORSHIP_LANE_META[lane];
  const selectedSummary =
    data.laneSummaries?.find((summary: any) => summary.lane === lane) ??
    data.laneSummaries?.[0] ?? { activeCircles: 0, openRequests: 0, peopleNeedingPrimaryMentor: 0 };
    
  const laneCircles = (data.circleSummaries ?? []).filter((circle: any) => circle.lane === lane);
  const laneUnassigned = (data.unassignedMentees ?? []).filter(
    (mentee: any) => mentee.lane === lane
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <PageHeaderV2
        eyebrow="Admin · Instructor Mentorship"
        title={ADMIN_MENTORSHIP_PAGE_TITLE}
        subtitle="Program health, approvals, pairings, goals, and committees for the instructor mentorship program."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isMentorship2Enabled() && (
              <ButtonLink href="/admin/mentorship/applications" variant="secondary" size="md">
                Applications
              </ButtonLink>
            )}
          </div>
        }
      />

      <TrackerStartCard
        title="Oversight Pulse Summary"
        description="Monitor macro program metrics, unstaffed pipelines, performance thresholds, and cycle completions across cohorts."
        action={
          <ButtonLink href="/admin/mentorship?tab=needs-attention" variant="secondary" size="sm">
            Review alerts
          </ButtonLink>
        }
        facts={[
          {
            label: "active pairs",
            value: (data.laneSummaries ?? []).reduce((acc: number, curr: any) => acc + (curr.activeCircles ?? 0), 0),
            href: "/admin/mentorship?tab=assignments",
          },
          {
            label: "unstaffed",
            value: opsSummary?.unassignedInstructors ?? 0,
            href: "/admin/mentorship?tab=assignments",
            tone: (opsSummary?.unassignedInstructors ?? 0) > 0 ? "attention" : "default",
          },
          {
            label: "overdue logs",
            value: opsSummary?.overdueCheckIns ?? 0,
            href: "/admin/mentorship?tab=needs-attention",
            tone: (opsSummary?.overdueCheckIns ?? 0) > 0 ? "danger" : "default",
          },
          {
            label: "pending reviews",
            value: (data.laneSummaries ?? []).reduce((acc: number, curr: any) => acc + (curr.openRequests ?? 0), 0),
            href: "/admin/mentorship?tab=approvals",
          },
        ]}
      />

      <div className="flex flex-col gap-3">
        <FilterBar aria-label="Mentorship panel views">
          {TABS.map((t) => (
            <FilterChipLink
              key={t.key}
              href={`/admin/mentorship?tab=${t.key}`}
              active={tab === t.key}
            >
              {t.label}
            </FilterChipLink>
          ))}
        </FilterBar>
      </div>

      {/* ── Overview / Pulse Tab ─────────────────── */}
      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardV2 className="p-4 border border-line-soft bg-surface rounded-xl shadow-sm">
              <p className="m-0 text-[24px] font-bold text-ink">{pulseData.activeCount}</p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">Active instructor mentorships</p>
            </CardV2>
            <CardV2 className="p-4 border border-line-soft bg-surface rounded-xl shadow-sm">
              <p className={`m-0 text-[24px] font-bold ${ (opsSummary?.unassignedInstructors ?? 0) > 0 ? "text-red-600" : "text-ink" }`}>
                {opsSummary?.unassignedInstructors ?? 0}
              </p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">Mentees without a mentor</p>
            </CardV2>
            <CardV2 className="p-4 border border-line-soft bg-surface rounded-xl shadow-sm">
              <p className={`m-0 text-[24px] font-bold ${ (opsSummary?.overdueCheckIns ?? 0) > 0 ? "text-amber-600" : "text-ink" }`}>
                {opsSummary?.overdueCheckIns ?? 0}
              </p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">Overdue check-ins</p>
            </CardV2>
            <CardV2 className="p-4 border border-line-soft bg-surface rounded-xl shadow-sm">
              <p className="m-0 text-[24px] font-bold text-ink">{pulseData.stalledGoalsCount}</p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">Stalled goals blueprints</p>
            </CardV2>
            <CardV2 className="p-4 border border-line-soft bg-surface rounded-xl shadow-sm">
              <p className="m-0 text-[24px] font-bold text-ink">{pulseData.pendingChairCount}</p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">Pending chair approvals</p>
            </CardV2>
            <CardV2 className="p-4 border border-line-soft bg-surface rounded-xl shadow-sm">
              <p className="m-0 text-[24px] font-bold text-ink">{pulseData.completionRate}%</p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">Reflection completion this cycle</p>
            </CardV2>
          </div>

          <RecordSection
            title="Rating Distribution (last 3 months)"
            description="Visual trend tracking of performance logs submitted across operational teams."
          >
            {pulseData.fairnessWarning && (
              <div className="mb-4 rounded-[8px] border-l-[3px] border-amber-500 bg-amber-50 p-3.5 text-[13px] text-amber-900">
                Fairness check: distribution looks skewed. High Above & Beyond or Behind rates may indicate inflated or overly harsh scoring. Review mentor patterns.
              </div>
            )}
            {pulseData.total === 0 ? (
              <p className="m-0 text-[13.5px] text-ink-muted">No approved ratings in the last 3 months.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {["BEHIND_SCHEDULE", "GETTING_STARTED", "ACHIEVED", "ABOVE_AND_BEYOND"].map((key) => {
                  const ratingCopy = getGoalRatingCopy(key);
                  const count = pulseData.ratingMap[key] ?? 0;
                  const pct = Math.round((count / pulseData.total) * 100);
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-medium text-ink">{ratingCopy.shortLabel} - {ratingCopy.label}</span>
                        <span className="text-ink-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-line-soft overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ratingCopy.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </RecordSection>

          {(pulseData.overCapacityMentors ?? []).length > 0 && (
            <RecordSection
              title="Over-Capacity Mentors"
              description="These active mentors currently cross or meet maximum active loads. Consider redistributing assignments."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {pulseData.overCapacityMentors.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-[8px] border border-line-soft bg-surface px-3.5 py-2.5">
                    <span className="text-[13.5px] font-semibold text-ink">{m.name}</span>
                    <StatusBadge tone="danger">{(m.mentorPairs ?? []).length} mentees</StatusBadge>
                  </div>
                ))}
              </div>
            </RecordSection>
          )}
        </div>
      )}

      {/* ── Needs Attention Tab ──────────────────── */}
      {tab === "needs-attention" && needsActionItems && (
        <RecordSection
          title="Needs attention"
          description="Start here. These items represent tracking friction points, staffing deadlocks, or delayed milestones."
        >
          {needsActionItems.length === 0 ? (
            <p className="m-0 text-[13.5px] text-ink-muted">Nothing is flagged right now — the queues are clear.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {needsActionItems.map((item: any) => (
                <li key={item.id} className="rounded-[8px] border border-line-soft bg-surface px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="m-0 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      {item.title}
                      <StatusBadge
                        tone={
                          item.kind === "UNASSIGNED_INSTRUCTOR"
                            ? "danger"
                            : item.kind === "NO_GOALS"
                              ? "warning"
                              : "info"
                        }
                      >
                        {(item.kind ?? "alert").toLowerCase().replaceAll("_", " ")}
                      </StatusBadge>
                    </div>
                    <Link href={item.href ?? "#"} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
                      {item.emphasis ?? "View details"} →
                    </Link>
                  </div>
                  <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      )}

      {/* ── Assignments Tab ─────────────────────── */}
      {tab === "assignments" && unassignedQueue && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADMIN_MENTORSHIP_LANES.map((laneOption) => {
              const summary = (data.laneSummaries ?? []).find((item: any) => item.lane === laneOption) ?? selectedSummary;
              const isSelected = laneOption === lane;
              return (
                <Link
                  key={laneOption}
                  href={`/admin/mentorship?tab=assignments&lane=${toLaneQueryValue(laneOption)}`}
                  scroll={false}
                  className="no-underline text-inherit"
                >
                  <CardV2 className={`p-4 border rounded-xl shadow-sm transition-colors ${isSelected ? "border-brand-500 bg-brand-50/20" : "border-line-soft bg-surface"}`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <strong className="text-[14px] text-ink">{ADMIN_MENTORSHIP_LANE_META[laneOption]?.label ?? laneOption}</strong>
                      {isSelected && <StatusBadge tone="info">Active</StatusBadge>}
                    </div>
                    <div className="flex flex-col gap-1 text-[12.5px] text-ink-muted">
                      <div>Circles: <span className="font-semibold text-ink">{summary.activeCircles ?? 0}</span></div>
                      <div>Unstaffed: <span className="font-semibold text-ink">{summary.peopleNeedingPrimaryMentor ?? 0}</span></div>
                    </div>
                  </CardV2>
                </Link>
              );
            })}
          </div>

          <RecordSection title={`${laneMeta?.label ?? "Circle"} Overview`} description="Scan unstaffed gaps and manage allocations inside structural circles.">
            <MenteeMatchingBoard
              unassigned={(laneUnassigned ?? []).map((mentee: any) => ({
                id: mentee.id, status: "UNASSIGNED", name: mentee.name, email: mentee.email, primaryRole: mentee.primaryRole, lane, chapterName: mentee.chapterName
              }))}
              matched={(laneCircles ?? []).map((c: any) => ({
                id: c.menteeId, status: "HAS_MENTOR", name: c.menteeName, email: c.menteeEmail, primaryRole: c.menteeRole, lane, chapterName: c.chapterName, mentorName: c.mentorName, mentorshipId: c.mentorshipId, circleGaps: c.missingRoles ?? []
              }))}
              lane={toLaneQueryValue(lane)}
            />
          </RecordSection>

          <RecordSection title="Shortlist Matching Engine" description="Evaluate alignment variables, cross-references, and capacity constraints before submitting matching updates.">
            <MatchingPanel
              key={`${lane}-${supportRole}-${searchParams.menteeId ?? "all"}`}
              initialLane={lane}
              initialSupportRole={supportRole}
              initialMenteeId={searchParams.menteeId}
              autoRun={Boolean(searchParams.menteeId)}
            />
          </RecordSection>
        </div>
      )}

      {/* ── Capacity / Workload Tab ─────────────── */}
      {tab === "capacity" && workloadRows && (
        <RecordSection title="Mentor Workload Tracking" description="Roster allocation density audits across leadership teams.">
          <div className="overflow-x-auto rounded-[10px] border border-line-soft bg-surface">
            <table className="w-full border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line-soft bg-surface-muted text-[12.5px] font-semibold text-ink-muted">
                  <th className="px-4 py-3">Mentor Roster Name</th>
                  <th className="px-4 py-3">Active Pairings</th>
                  <th className="px-4 py-3">Capacity Threshold Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {workloadRows.map((m: any) => (
                  <tr key={m.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-semibold text-ink">{m.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{m.activeCount ?? 0} pairs</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={(m.activeCount ?? 0) >= 3 ? "danger" : "success"}>
                        {m.activeCount ?? 0} / 3 Threshold Capacity
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RecordSection>
      )}

      {/* ── Approvals Tab (FIXED: Boards split into separate functional sections) ── */}
      {tab === "approvals" && (
        <div className="flex flex-col gap-8">
          <RecordSection 
            title="Growth & Reflection Approvals" 
            description="Review and ratify structural adjustments, core adjustments, and target framework updates."
          >
            <GoalReviewsBoard reviews={Array.isArray(goalReviews) ? goalReviews : []} />
          </RecordSection>

          <RecordSection 
            title="Monthly Log Approvals" 
            description="Audit and clear periodic milestones, tracking metrics, and cohort checkpoints."
          >
            <ReviewApprovalsBoard reviews={Array.isArray(monthlyReviews) ? monthlyReviews : []} />
          </RecordSection>
        </div>
      )}

      {/* ── Goals & Resources Tab ──────────────── */}
      {tab === "templates" && grData && (
        <div className="flex flex-col gap-6">
          <RecordSection title="Core Framework Standards" description="Author framework blueprints, target thresholds, and system templates.">
            <GRTemplateListPanel templates={grData.templates} />
            <GRResourceLibraryPanel resources={grData.resources} />
            <GRAssignmentsPanel documents={grData.documents} goalChanges={grData.goalChanges} templates={grData.templateOptions} />
          </RecordSection>
        </div>
      )}

      {/* ── Committees & Chairs Tab ────────────── */}
      {tab === "committees" && (
        <div className="flex flex-col gap-6">
          <RecordSection title="Oversight Governance Circles" description="Delegate regional boundaries, structural chairs, and cross-team audit systems.">
            <ChairsPanel chairs={chairsData} eligibleUsers={eligibleUsersData ?? []} />
          </RecordSection>
        </div>
      )}

      {/* ── Analytics Tab ──────────────────────── */}
      {tab === "analytics" && (
        <div className="flex flex-col gap-6">
          <RecordSection title="Program Telemetry Engine" description="Analyze global timeline velocities, rating spreads, and health indices.">
            <AnalyticsPanel
              analytics={{
                ...(programAnalytics || {
                  activePairs: 0,
                  totalReflections: 0,
                  reviews: { draft: 0, pendingChair: 0, changesRequested: 0, approved: 0 },
                  totalPointsAwarded: 0,
                  tierDistribution: { NONE: 0, BRONZE: 0, SILVER: 0, GOLD: 0, LIFETIME: 0 },
                  nominationsByTier: {},
                  recentApprovals: [],
                  reflectionsByCycle: []
                })
              }}
            />
          </RecordSection>
        </div>
      )}
    </div>
  );
}