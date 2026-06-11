// Admin Leadership & Contributions dashboard — who owns what, advising
// coverage, contributions needing follow-up, and Senior/Lead expectation
// standing across the instructor team.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isLeadershipRolesEnabled } from "@/lib/feature-flags";
import { loadAdminLeadershipDashboard } from "@/lib/leadership/queries";
import { ownershipGaps } from "@/lib/leadership/filters";
import { LEADERSHIP_ROLE_CATALOG } from "@/lib/leadership/constants";
import { AdvisingStatusPill, StandingPill, formatLeadershipDate } from "@/components/leadership/ui";
import { AssignAdvisorForm, AssignContributionForm } from "@/components/leadership/assign-forms";
import { ContributionsTable } from "./contributions-table";

export const dynamic = "force-dynamic";

export default async function AdminLeadershipPage() {
  if (!isLeadershipRolesEnabled()) redirect("/admin");
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const [dashboard, students, partners] = await Promise.all([
    loadAdminLeadershipDashboard(),
    prisma.user.findMany({
      where: { archivedAt: null, roles: { some: { role: "STUDENT" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeContributions = dashboard.contributionRows.filter(
    (row) => row.status === "ACTIVE" || row.status === "ASSIGNED",
  );
  const needsAttention = dashboard.contributionRows.filter(
    (row) => row.status === "NEEDS_ATTENTION",
  );
  const leadReady = dashboard.expectations.filter((e) => e.progress.lead.met);
  const seniorReady = dashboard.expectations.filter(
    (e) => e.progress.senior.met && !e.progress.lead.met,
  );
  const below = dashboard.expectations.filter((e) => !e.progress.senior.met);
  const gaps = ownershipGaps(dashboard.ownershipGapRows);

  return (
    <div>
      <p className="badge">Admin · Leadership</p>
      <h1 className="page-title">Leadership Roles & Contributions</h1>
      <p className="page-subtitle">
        Assign and track leadership roles beyond teaching — Student Advisors, mentors,
        reviewers, interviewers, committee members, and ownership areas. This is the evidence
        base for reviews and Senior/Lead promotions.
      </p>

      <div className="grid four instructor-ops-metrics" style={{ marginBottom: 16 }}>
        <Metric label="Active roles" value={String(activeContributions.length)} detail={`${dashboard.contributionRows.length} total`} />
        <Metric label="Needs attention" value={String(needsAttention.length + dashboard.followUps.length)} detail={`${dashboard.followUps.length} advising follow-ups`} />
        <Metric label="Students without advisor" value={String(dashboard.unadvisedStudents.length)} detail={`${dashboard.caseloads.filter((c) => c.activeCount > 0).length} active advisors`} />
        <Metric label="Meet Lead expectations" value={String(leadReady.length)} detail={`${seniorReady.length} meet Senior`} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <AssignContributionForm
          instructors={dashboard.instructorOptions}
          partners={partners}
        />
        <AssignAdvisorForm advisors={dashboard.instructorOptions} students={students} />
      </div>

      {/* ── Advising coverage ─────────────────────────────────────────────── */}
      <section className="card instructor-profile-section">
        <SectionHeading
          title="Student advising coverage"
          detail="Who has an advisor, who needs one, and whether advisors are actually doing the role."
        />
        <div className="instructor-profile-two-column" style={{ alignItems: "start" }}>
          <div>
            <h3>Advisor caseloads</h3>
            {dashboard.caseloads.filter((c) => c.activeCount > 0).length === 0 ? (
              <p className="instructor-profile-muted">No active advisors yet — assign one above.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {dashboard.caseloads
                  .filter((c) => c.activeCount > 0)
                  .sort((a, b) => b.activeCount - a.activeCount)
                  .map((caseload) => (
                    <div
                      key={caseload.advisorId}
                      style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Link href={`/admin/instructors/${caseload.advisorId}`}>
                        {caseload.advisorName}
                      </Link>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <span>{caseload.activeCount} students</span>
                        {caseload.band === "HIGH" && <span className="pill pill-small pill-warning">High caseload</span>}
                        {caseload.band === "LOW" && <span className="pill pill-small pill-neutral">Low caseload</span>}
                        {caseload.health === "ACTIVE" && <span className="pill pill-small pill-success">Active</span>}
                        {caseload.health === "STALE" && <span className="pill pill-small pill-warning">Stale</span>}
                        {caseload.health === "INACTIVE" && <span className="pill pill-small pill-attention">Inactive</span>}
                        {caseload.needsFollowUpCount > 0 && (
                          <span className="pill pill-small pill-attention">{caseload.needsFollowUpCount} follow-ups</span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <h3 style={{ marginTop: 16 }}>Students needing follow-up</h3>
            {dashboard.followUps.length === 0 ? (
              <p className="instructor-profile-muted">No advising follow-ups flagged.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {dashboard.followUps.map((followUp) => (
                  <Link
                    key={followUp.assignmentId}
                    href={`/my-advisees/${followUp.assignmentId}`}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <span>
                      <strong>{followUp.studentName}</strong>
                      <span style={{ color: "var(--muted, #6b7280)" }}> · advisor {followUp.advisorName}</span>
                      {followUp.followUpNote && (
                        <span style={{ color: "var(--muted, #6b7280)" }}> — {followUp.followUpNote}</span>
                      )}
                    </span>
                    <AdvisingStatusPill status={followUp.advisingStatus} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3>Students without an advisor ({dashboard.unadvisedStudents.length})</h3>
            {dashboard.unadvisedStudents.length === 0 ? (
              <p className="instructor-profile-muted">Every student has an advisor. 🎉</p>
            ) : (
              <>
                <div style={{ display: "grid", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                  {dashboard.unadvisedStudents.slice(0, 40).map((student) => (
                    <div key={student.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{student.name}</span>
                      <span style={{ color: "var(--muted, #6b7280)" }}>{student.chapterName ?? "No chapter"}</span>
                    </div>
                  ))}
                </div>
                {dashboard.unadvisedStudents.length > 40 && (
                  <p style={{ fontSize: 12, color: "var(--muted, #6b7280)", margin: "6px 0 0" }}>
                    +{dashboard.unadvisedStudents.length - 40} more — use the assign form above.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── All contributions ─────────────────────────────────────────────── */}
      <section className="card instructor-profile-section">
        <SectionHeading
          title="All leadership roles"
          detail="Filter by role type, instructor, level, or status. Status changes here update the instructor's record immediately."
        />
        <ContributionsTable rows={dashboard.contributionRows} instructors={dashboard.instructorOptions} />
      </section>

      {/* ── Expectations ──────────────────────────────────────────────────── */}
      <section className="card instructor-profile-section">
        <SectionHeading
          title="Senior / Lead expectations"
          detail="Senior: 1-2 meaningful contributions. Lead: 2-3 meaningful, at least one with real ownership."
        />
        <div className="instructor-profile-two-column" style={{ alignItems: "start" }}>
          <div>
            <h3>Strong promotion / leadership candidates</h3>
            {leadReady.length === 0 && seniorReady.length === 0 ? (
              <p className="instructor-profile-muted">No instructors meet expectations yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {[...leadReady, ...seniorReady].map((expectation) => (
                  <div key={expectation.instructorId} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                    <Link href={`/admin/instructors/${expectation.instructorId}`}>
                      {expectation.instructorName}
                    </Link>
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <span style={{ color: "var(--muted, #6b7280)" }}>
                        {expectation.progress.meaningfulCount} meaningful · {expectation.progress.ownershipCount} ownership
                      </span>
                      <StandingPill standing={expectation.progress.standing} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3>Below expectations ({below.length})</h3>
            {below.length === 0 ? (
              <p className="instructor-profile-muted">Every instructor meets at least the Senior bar.</p>
            ) : (
              <div style={{ display: "grid", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                {below.map((expectation) => (
                  <div key={expectation.instructorId} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <Link href={`/admin/instructors/${expectation.instructorId}`}>
                      {expectation.instructorName}
                    </Link>
                    <StandingPill standing={expectation.progress.standing} />
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ marginTop: 16 }}>Ownership gaps</h3>
            {gaps.length === 0 ? (
              <p className="instructor-profile-muted">Every ownership area has an active owner.</p>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {gaps.map((category) => (
                  <span key={category} className="pill pill-small pill-warning">
                    {LEADERSHIP_ROLE_CATALOG[category].label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card instructor-ops-metric">
      <span className="kpi">{value}</span>
      <span className="kpi-label">{label}</span>
      <span>{detail}</span>
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="instructor-ops-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}
