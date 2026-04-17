import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import {
  getAdminPortalAnalytics,
  UNMAPPED_INTEREST_AREA,
} from "@/lib/admin-portal-analytics";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatPercent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

function formatDays(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(1)} days`;
}

function formatEnum(value: string) {
  return value.replace(/_/g, " ");
}

function EmptyState({ message }: { message: string }) {
  return <p style={{ color: "var(--muted)", margin: 0 }}>{message}</p>;
}

export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    dateRange?: string;
    chapterId?: string;
    interestArea?: string;
  }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const params = await searchParams;
  const analytics = await getAdminPortalAnalytics(params);
  const { filters, filterOptions } = analytics;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Portal Reliability Dashboard</h1>
          <p className="page-subtitle">
            One place to watch operations, growth, and workflow health across recruiting, offering approvals,
            curriculum, registrations, and mentorship.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/chapter/recruiting" className="button secondary small">
            Recruiting
          </Link>
          <Link href="/admin/instructor-readiness" className="button secondary small">
            Approvals
          </Link>
          <Link href="/admin/mentorship-program" className="button secondary small">
            Mentorship
          </Link>
          <Link href="/admin/goals" className="button secondary small">
            Goals
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <div className="section-title">Shared Filters</div>
            <p style={{ color: "var(--muted)", marginTop: 6, marginBottom: 0, fontSize: 13 }}>
              Date range powers recent activity metrics. Chapter applies across the dashboard.
              Interest area is used where the record actually carries subject metadata, and blank
              values are grouped into <strong>{UNMAPPED_INTEREST_AREA}</strong>.
            </p>
          </div>
          <form method="GET" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Date range
              <select name="dateRange" className="input" defaultValue={filters.dateRange}>
                {filterOptions.dateRanges.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Chapter
              <select
                name="chapterId"
                className="input"
                defaultValue={filters.chapterId ?? ""}
              >
                <option value="">All chapters</option>
                {filterOptions.chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Interest area
              <select
                name="interestArea"
                className="input"
                defaultValue={filters.interestArea ?? ""}
              >
                <option value="">All interest areas</option>
                {filterOptions.interestAreas.map((interestArea) => (
                  <option key={interestArea} value={interestArea}>
                    {interestArea}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button type="submit" className="button small">
                Apply
              </button>
              <Link href="/admin/analytics" className="button secondary small">
                Reset
              </Link>
            </div>
          </form>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Recent Applications</div>
          <div className="kpi">{formatNumber(analytics.summary.recentApplications)}</div>
          <p className="kpi-label">submitted in selected window</p>
        </div>
        <div className="card">
          <div className="section-title">Review Backlog</div>
          <div className="kpi">{formatNumber(analytics.summary.currentReviewBacklog)}</div>
          <p className="kpi-label">current open recruiting records</p>
        </div>
        <div className="card">
          <div className="section-title">Course Enrollments</div>
          <div className="kpi">{formatNumber(analytics.summary.recentCourseEnrollments)}</div>
          <p className="kpi-label">recent enrollments in selected window</p>
        </div>
        <div className="card">
          <div className="section-title">Active Mentorships</div>
          <div className="kpi">{formatNumber(analytics.summary.activeMentorships)}</div>
          <p className="kpi-label">current pairings in scope</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Applications And Offering Approvals</div>
        <div className="grid four" style={{ marginBottom: 20 }}>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatPercent(analytics.applications.recent.interviewConversionPct)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Interview conversion in selected window</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatDays(analytics.applications.recent.averageDaysToDecision)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Average days to approved decision</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.applications.currentPendingChairDecisions)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Current chair approvals waiting</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.readinessAndTraining.currentSnapshot.openApprovalQueue)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Current offering approvals waiting</div>
          </div>
        </div>

        <div className="grid two">
          <div className="card" style={{ margin: 0 }}>
            <div className="section-title">Current Application Statuses</div>
            {analytics.applications.statusBreakdown.length === 0 ? (
              <EmptyState message="No recruiting records matched the current chapter filter." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.applications.statusBreakdown.map((row) => (
                    <tr key={row.status}>
                      <td>{formatEnum(row.status)}</td>
                      <td>{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="section-title">Position Types In Pipeline</div>
            {analytics.applications.positionTypeBreakdown.length === 0 ? (
              <EmptyState message="No position types matched the current chapter filter." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.applications.positionTypeBreakdown.map((row) => (
                    <tr key={row.type}>
                      <td>{formatEnum(row.type)}</td>
                      <td>{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid four" style={{ marginTop: 20 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.readinessAndTraining.currentSnapshot.openEvidenceBacklog)}</div>
            <div className="kpi-label">Evidence reviews waiting</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatDays(analytics.readinessAndTraining.currentSnapshot.averageApprovalQueueAgeDays)}</div>
            <div className="kpi-label">Average offering approval queue age</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.applications.recent.approvedDecisionCount)}</div>
            <div className="kpi-label">Approved decisions in selected window</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.applications.recent.submitted)}</div>
            <div className="kpi-label">Applications submitted in selected window</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Training And Curriculum Launch Funnel</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Approval-readiness cards below are current operational snapshots. The interest-area filter applies
          to curriculum draft metrics in this section.
        </p>

        <div className="grid four" style={{ marginBottom: 20 }}>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.readinessAndTraining.currentSnapshot.trainingComplete)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Instructors with required training complete</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.readinessAndTraining.currentSnapshot.interviewPassed)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Instructors with interview passed or waived</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.readinessAndTraining.currentSnapshot.approvalReadyInstructors)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Ready to request offering approval</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.readinessAndTraining.currentSnapshot.readinessBlockedInstructors)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Still blocked on training or interview readiness</div>
          </div>
        </div>

        <div className="grid three" style={{ marginBottom: 20 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.readinessAndTraining.currentSnapshot.instructorCount)}</div>
            <div className="kpi-label">Instructors in current chapter scope</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.readinessAndTraining.curriculum.recentCreated)}</div>
            <div className="kpi-label">Curriculum drafts created in selected window</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.readinessAndTraining.curriculum.recentApproved)}</div>
            <div className="kpi-label">Curriculum drafts approved in selected window</div>
          </div>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="section-title">Current Curriculum Draft Statuses</div>
          {analytics.readinessAndTraining.curriculum.currentStatusBreakdown.length === 0 ? (
            <EmptyState message="No curriculum drafts matched the current filters." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {analytics.readinessAndTraining.curriculum.currentStatusBreakdown.map((row) => (
                  <tr key={row.status}>
                    <td>{formatEnum(row.status)}</td>
                    <td>{formatNumber(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Registrations And Enrollments By Chapter And Subject</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          These are intentionally split so course enrollments and pathway-event registrations do not
          get merged into one misleading total.
        </p>

        <div className="grid two" style={{ marginBottom: 20 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.registrations.recentCourseEnrollments)}</div>
            <div className="kpi-label">Course enrollments in selected window</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{formatNumber(analytics.registrations.recentPathwayRegistrations)}</div>
            <div className="kpi-label">Pathway-event registrations in selected window</div>
          </div>
        </div>

        <div className="grid two">
          <div className="card" style={{ margin: 0 }}>
            <div className="section-title">Course Enrollments Breakdown</div>
            {analytics.registrations.courseEnrollmentBreakdown.length === 0 ? (
              <EmptyState message="No course enrollments matched the current filters." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Chapter</th>
                    <th>Interest Area</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.registrations.courseEnrollmentBreakdown.map((row) => (
                    <tr key={`${row.chapterName}-${row.interestArea}`}>
                      <td>{row.chapterName}</td>
                      <td>{row.interestArea}</td>
                      <td>{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="section-title">Pathway-Event Registration Breakdown</div>
            {analytics.registrations.pathwayRegistrationBreakdown.length === 0 ? (
              <EmptyState message="No pathway-event registrations matched the current filters." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Registrant Chapter</th>
                    <th>Interest Area</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.registrations.pathwayRegistrationBreakdown.map((row) => (
                    <tr key={`${row.chapterName}-${row.interestArea}`}>
                      <td>{row.chapterName}</td>
                      <td>{row.interestArea}</td>
                      <td>{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Mentorship And Goal-Review Health</div>
        <div className="grid five" style={{ marginBottom: 20 }}>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.mentorship.currentSnapshot.activePairings)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Active pairings</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.mentorship.currentSnapshot.staleCircles)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Stale circles</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.mentorship.currentSnapshot.overdueReflections)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Overdue reflections</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.mentorship.currentSnapshot.openSupportRequests)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Open support requests</div>
          </div>
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatNumber(analytics.mentorship.currentSnapshot.pendingChairReviews)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Pending chair approvals</div>
          </div>
        </div>

        <div className="grid two">
          <div className="card" style={{ margin: 0 }}>
            <div className="section-title">Goal Review Statuses</div>
            {analytics.mentorship.reviews.statusBreakdown.length === 0 ? (
              <EmptyState message="No goal reviews matched the current chapter filter." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.mentorship.reviews.statusBreakdown.map((row) => (
                    <tr key={row.status}>
                      <td>{formatEnum(row.status)}</td>
                      <td>{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="section-title">Chair Review Speed</div>
            <div className="grid two">
              <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {formatDays(analytics.mentorship.reviews.averageChairApprovalDays)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Average approval lag in selected window</div>
              </div>
              <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {formatNumber(analytics.mentorship.reviews.recentApprovedCount)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Reviews approved in selected window</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
