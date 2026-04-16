import Link from "next/link";
import { redirect } from "next/navigation";
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
import { getMentorCapacityStatus } from "@/lib/mentorship-access";

export const metadata = { title: "Mentorship Admin — YPP Portal" };

const TABS = [
  { key: "pulse", label: "Pulse" },
  { key: "approvals", label: "Approvals" },
  { key: "pairings", label: "Pairings" },
  { key: "goals", label: "Goals" },
  { key: "committees", label: "Committees" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function parseTab(raw?: string): Tab {
  if (raw === "approvals" || raw === "pairings" || raw === "goals" || raw === "committees") {
    return raw;
  }
  return "pulse";
}

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
    prisma.mentorship.count({ where: { status: "ACTIVE" } }),
    prisma.mentorGoalReview.count({ where: { status: "PENDING_CHAIR_APPROVAL" } }),
    prisma.mentorship.count({ where: { status: "ACTIVE", cycleStage: "REFLECTION_DUE" } }),
    prisma.monthlySelfReflection.count({ where: { cycleMonth: { gte: cycleStart } } }),
    prisma.goalReviewRating.groupBy({
      by: ["rating"],
      _count: true,
      where: {
        review: {
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) },
          status: "APPROVED",
        },
      },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: "MENTOR" } } },
      select: {
        id: true,
        name: true,
        mentorLinks: {
          where: { status: "ACTIVE" },
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

  const overCapacityMentors = mentorCapacityWarnings.filter((m) => m.mentorLinks.length > 3);

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
  const mentors = await prisma.user.findMany({
    where: { roles: { some: { role: "MENTOR" } } },
    select: {
      id: true,
      name: true,
      email: true,
      mentorLinks: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          cycleStage: true,
          mentee: { select: { name: true, primaryRole: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return mentors.map((m) => ({
    id: m.id,
    name: m.name ?? m.email,
    menteeCount: m.mentorLinks.length,
    mentees: m.mentorLinks.map((link) => ({
      name: link.mentee.name ?? "",
      role: link.mentee.primaryRole ?? "",
      stage: link.cycleStage,
    })),
    isAtCapacity: m.mentorLinks.length >= 3,
    isOverCapacity: m.mentorLinks.length > 3,
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

  const [data, goalReviews, monthlyReviews] = await Promise.all([
    getAdminMentorshipCommandCenterData(),
    tab === "approvals" ? getMentorshipGoalReviews() : Promise.resolve([]),
    tab === "approvals" ? getMentorshipMonthlyReviews() : Promise.resolve([]),
  ]);

  const pulseData = tab === "pulse" ? await getPulseData() : null;
  const pairingsData = tab === "pairings" ? await getPairingsData() : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Mentorship</p>
          <h1 className="page-title">Mentorship Oversight</h1>
          <p className="page-subtitle">Program health, approvals, pairings, goals, and committees.</p>
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
              <p className="kpi-label">Active pairings</p>
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
              <p className="kpi" style={{ color: pulseData.overCapacityMentors.length > 0 ? "#ef4444" : undefined }}>
                {pulseData.overCapacityMentors.length}
              </p>
              <p className="kpi-label">Mentors over capacity (3+)</p>
            </div>
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
                      {m.mentorLinks.length} mentees
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
