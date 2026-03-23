import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewCPApplicationAction } from "@/lib/chapter-president-application-actions";
import { saveCPApplicationScores } from "@/lib/export-actions";
import { ChapterPresidentApplicationStatus } from "@prisma/client";
import CPApplicantsClient from "./client";

function statusColor(status: ChapterPresidentApplicationStatus): string {
  if (status === "APPROVED") return "#16a34a";
  if (status === "REJECTED") return "#dc2626";
  if (status === "INFO_REQUESTED") return "#d97706";
  if (status === "INTERVIEW_SCHEDULED" || status === "INTERVIEW_COMPLETED") return "#2563eb";
  return "#7c3aed";
}

function statusLabel(status: ChapterPresidentApplicationStatus): string {
  switch (status) {
    case "SUBMITTED": return "Submitted";
    case "UNDER_REVIEW": return "Under Review";
    case "INFO_REQUESTED": return "Info Requested";
    case "INTERVIEW_SCHEDULED": return "Interview Scheduled";
    case "INTERVIEW_COMPLETED": return "Interview Completed";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
  }
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compositeScore(app: {
  scoreLeadership: number | null;
  scoreVision: number | null;
  scoreOrganization: number | null;
  scoreCommitment: number | null;
  scoreFit: number | null;
}): number | null {
  const scores = [app.scoreLeadership, app.scoreVision, app.scoreOrganization, app.scoreCommitment, app.scoreFit];
  const valid = scores.filter((s): s is number => s != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: "var(--muted)", width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} style={{ width: 10, height: 10, borderRadius: 2, background: score != null && n <= score ? "#7c3aed" : "var(--surface-2)", border: "1px solid var(--border)" }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{score != null ? `${score}/5` : "—"}</span>
    </div>
  );
}

export default async function AdminCPApplicantsPage({
  searchParams,
}: {
  searchParams: { status?: string; grad?: string; state?: string; search?: string };
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const filterStatus = searchParams.status as ChapterPresidentApplicationStatus | undefined;
  const filterGrad = searchParams.grad ? parseInt(searchParams.grad, 10) : undefined;
  const filterState = searchParams.state;
  const filterSearch = searchParams.search;

  const where: Record<string, unknown> = {};
  if (filterStatus && Object.values(ChapterPresidentApplicationStatus).includes(filterStatus)) {
    where.status = filterStatus;
  }
  if (filterGrad && !isNaN(filterGrad)) where.graduationYear = filterGrad;
  if (filterState) where.stateProvince = { contains: filterState, mode: "insensitive" };
  if (filterSearch) {
    where.OR = [
      { legalName: { contains: filterSearch, mode: "insensitive" } },
      { applicant: { name: { contains: filterSearch, mode: "insensitive" } } },
      { applicant: { email: { contains: filterSearch, mode: "insensitive" } } },
      { schoolName: { contains: filterSearch, mode: "insensitive" } },
      { city: { contains: filterSearch, mode: "insensitive" } },
      { partnerSchool: { contains: filterSearch, mode: "insensitive" } },
    ];
  }

  const applications = await prisma.chapterPresidentApplication.findMany({
    where,
    include: {
      applicant: { select: { id: true, name: true, email: true, chapter: { select: { name: true } } } },
      chapter: { select: { name: true } },
      reviewer: { select: { name: true } },
      customResponses: { include: { field: { select: { label: true, fieldType: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const allApps = await prisma.chapterPresidentApplication.findMany({
    select: { status: true, approvedAt: true },
  });

  const pending = allApps.filter((a) => ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(a.status));
  const interviewing = allApps.filter((a) => ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(a.status));
  const thisMonth = allApps.filter((a) => {
    if (a.status !== "APPROVED" || !a.approvedAt) return false;
    const now = new Date();
    const d = new Date(a.approvedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const gradYears = await prisma.chapterPresidentApplication.findMany({
    where: { graduationYear: { not: null } },
    select: { graduationYear: true },
    distinct: ["graduationYear"],
    orderBy: { graduationYear: "asc" },
  });

  const saveScoresAction = saveCPApplicationScores.bind(null, { status: "idle", message: "" });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Admin</span>
          <h1 className="page-title">Chapter President Applicants</h1>
          <p className="page-subtitle">Review and manage chapter president applications.</p>
        </div>
        <CPApplicantsClient applications={applications} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          The canonical chapter-president hiring flow also runs through{" "}
          <Link href="/chapter/recruiting" className="link">Chapter Recruiting</Link> and{" "}
          <Link href="/applications" className="link">Applications</Link>.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card kpi">
          <div className="kpi-value">{pending.length}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{interviewing.length}</div>
          <div className="kpi-label">In Interview Stage</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{thisMonth.length}</div>
          <div className="kpi-label">Approved This Month</div>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>SEARCH</label>
          <input className="input" name="search" defaultValue={filterSearch} placeholder="Name, email, school, city..." style={{ width: 200, marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>STATUS</label>
          <select className="input" name="status" defaultValue={filterStatus ?? ""} style={{ marginBottom: 0 }}>
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="INFO_REQUESTED">Info Requested</option>
            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
            <option value="INTERVIEW_COMPLETED">Interview Completed</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>GRAD YEAR</label>
          <select className="input" name="grad" defaultValue={filterGrad ?? ""} style={{ marginBottom: 0 }}>
            <option value="">All years</option>
            {gradYears.map((g) => (
              <option key={g.graduationYear} value={g.graduationYear!}>{g.graduationYear}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>STATE/PROVINCE</label>
          <input className="input" name="state" defaultValue={filterState} placeholder="e.g. Texas" style={{ width: 130, marginBottom: 0 }} />
        </div>
        <button className="button secondary" type="submit" style={{ fontSize: 13 }}>Filter</button>
        <Link href="/admin/chapter-president-applicants" className="button secondary" style={{ fontSize: 13 }}>Clear</Link>
      </form>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        Showing <strong>{applications.length}</strong> application{applications.length !== 1 ? "s" : ""}
      </p>

      {/* Application list */}
      {applications.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>
            No chapter president applications match your filters.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {applications.map((app) => {
            const comp = compositeScore(app);
            return (
              <details key={app.id} className="card">
                <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{app.legalName || app.applicant.name}</span>
                      {app.preferredFirstName && app.legalName && (
                        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>({app.preferredFirstName})</span>
                      )}
                      <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>{app.applicant.email}</span>
                    </div>
                    {app.chapter ? (
                      <span style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface-2)", borderRadius: 4, padding: "2px 8px" }}>
                        {app.chapter.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#d97706", background: "#fef3c7", borderRadius: 4, padding: "2px 8px" }}>
                        New Chapter Proposal
                      </span>
                    )}
                    {app.graduationYear && (
                      <span style={{ fontSize: 12, background: "#ede9fe", color: "#7c3aed", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                        Class of {app.graduationYear}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {comp != null && (
                      <span style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                        Score: {comp.toFixed(1)}/5
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Applied {formatDate(app.createdAt)}</span>
                    <span className="badge" style={{ background: statusColor(app.status), color: "white", fontSize: 11 }}>
                      {statusLabel(app.status)}
                    </span>
                  </div>
                </summary>

                <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>

                  {/* Quick info bar */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16, fontSize: 13 }}>
                    {(app.city || app.stateProvince) && (
                      <span>📍 {[app.city, app.stateProvince, app.country].filter(Boolean).join(", ")}</span>
                    )}
                    {app.schoolName && <span>🏫 {app.schoolName}</span>}
                    {app.partnerSchool && <span>🏛 Partner: {app.partnerSchool}</span>}
                    {app.gpa && <span>📊 GPA: {app.gpa}</span>}
                    {app.classRank && <span>🏆 {app.classRank}</span>}
                    {app.hoursPerWeek && <span>⏱ {app.hoursPerWeek}h/week</span>}
                    {app.phoneNumber && <span>📞 {app.phoneNumber}</span>}
                    {app.hearAboutYPP && <span>📣 Via: {app.hearAboutYPP}</span>}
                    {app.ethnicity && <span>👤 {app.ethnicity}</span>}
                  </div>

                  {/* Application details */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    {app.whyChapterPresident && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>WHY CHAPTER PRESIDENT</p>
                        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.whyChapterPresident}</p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>LEADERSHIP EXPERIENCE</p>
                      <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.leadershipExperience}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>CHAPTER VISION</p>
                      <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.chapterVision}</p>
                    </div>
                    {app.recruitmentPlan && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>RECRUITMENT PLAN</p>
                        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.recruitmentPlan}</p>
                      </div>
                    )}
                    {app.launchPlan && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>LAUNCH PLAN</p>
                        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.launchPlan}</p>
                      </div>
                    )}
                    {app.priorOrganizing && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>PRIOR ORGANIZING</p>
                        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.priorOrganizing}</p>
                      </div>
                    )}
                    {app.extracurriculars && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>EXTRACURRICULARS</p>
                        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.extracurriculars}</p>
                      </div>
                    )}
                    {app.specialSkills && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>SPECIAL SKILLS</p>
                        <p style={{ fontSize: 14, margin: 0 }}>{app.specialSkills}</p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>INTERVIEW AVAILABILITY</p>
                      <p style={{ fontSize: 14, margin: 0 }}>{app.availability}</p>
                    </div>
                    {app.preferredStartDate && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>PREFERRED LAUNCH DATE</p>
                        <p style={{ fontSize: 14, margin: 0 }}>{app.preferredStartDate}</p>
                      </div>
                    )}
                    {app.reviewer && (
                      <div>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>REVIEWER</p>
                        <p style={{ fontSize: 14, margin: 0 }}>{app.reviewer.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Referral emails */}
                  {app.referralEmails && (
                    <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: "#16a34a", margin: "0 0 4px", fontWeight: 600 }}>REFERRED STUDENTS</p>
                      <p style={{ fontSize: 13, margin: 0 }}>{app.referralEmails}</p>
                    </div>
                  )}

                  {/* Custom form responses */}
                  {app.customResponses.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px", fontWeight: 600 }}>ADDITIONAL RESPONSES</p>
                      {app.customResponses.map((resp) => (
                        <div key={resp.id} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 2px", fontWeight: 600 }}>{resp.field.label}</p>
                          <p style={{ fontSize: 14, margin: 0 }}>{resp.value}</p>
                          {resp.fileUrl && (
                            <a href={resp.fileUrl} target="_blank" className="link" style={{ fontSize: 12 }}>View uploaded file</a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {app.infoRequest && (
                    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>INFO REQUEST SENT</p>
                      <p style={{ fontSize: 14, margin: 0 }}>{app.infoRequest}</p>
                    </div>
                  )}
                  {app.applicantResponse && (
                    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>APPLICANT RESPONSE</p>
                      <p style={{ fontSize: 14, margin: 0 }}>{app.applicantResponse}</p>
                    </div>
                  )}
                  {app.reviewerNotes && (
                    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>REVIEWER NOTES</p>
                      <p style={{ fontSize: 14, margin: 0 }}>{app.reviewerNotes}</p>
                    </div>
                  )}

                  {/* Scoring Rubric */}
                  <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      Scoring Rubric
                      {comp != null && (
                        <span style={{ marginLeft: 8, color: "#16a34a", fontWeight: 700 }}>— Current: {comp.toFixed(1)}/5</span>
                      )}
                    </summary>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ marginBottom: 10 }}>
                        <ScoreBar score={app.scoreLeadership} label="Leadership" />
                        <ScoreBar score={app.scoreVision} label="Vision & Strategy" />
                        <ScoreBar score={app.scoreOrganization} label="Organization" />
                        <ScoreBar score={app.scoreCommitment} label="Commitment" />
                        <ScoreBar score={app.scoreFit} label="Cultural Fit" />
                      </div>
                      <form action={saveScoresAction}>
                        <input type="hidden" name="applicationId" value={app.id} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          {(["scoreLeadership", "scoreVision", "scoreOrganization", "scoreCommitment", "scoreFit"] as const).map((key) => {
                            const labels: Record<string, string> = {
                              scoreLeadership: "Leadership (1-5)",
                              scoreVision: "Vision & Strategy (1-5)",
                              scoreOrganization: "Organization (1-5)",
                              scoreCommitment: "Commitment (1-5)",
                              scoreFit: "Cultural Fit (1-5)",
                            };
                            return (
                              <label key={key} className="form-label" style={{ marginTop: 0, fontSize: 12 }}>
                                {labels[key]}
                                <select className="input" name={key} defaultValue={app[key] ?? ""} style={{ marginBottom: 0, fontSize: 13 }}>
                                  <option value="">—</option>
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                        <label className="form-label" style={{ fontSize: 12, marginTop: 0 }}>
                          Reviewer Notes
                          <textarea className="input" name="reviewerNotes" defaultValue={app.reviewerNotes ?? ""} rows={2} placeholder="Internal notes about this applicant..." style={{ marginBottom: 4 }} />
                        </label>
                        <button className="button secondary" type="submit" style={{ fontSize: 12 }}>Save Scores &amp; Notes</button>
                      </form>
                    </div>
                  </details>

                  {/* Actions */}
                  {!["APPROVED", "REJECTED"].includes(app.status) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                      {app.status === "SUBMITTED" && (
                        <form action={reviewCPApplicationAction}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="action" value="mark_under_review" />
                          <button className="button secondary" type="submit" style={{ fontSize: 13 }}>Mark as Under Review</button>
                        </form>
                      )}

                      <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Request More Info</summary>
                        <form action={reviewCPApplicationAction} style={{ marginTop: 10 }}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="action" value="request_info" />
                          <textarea className="input" name="message" required rows={3} placeholder="What additional information do you need?" style={{ marginBottom: 8 }} />
                          <button className="button secondary" type="submit" style={{ fontSize: 13 }}>Send Request</button>
                        </form>
                      </details>

                      <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Schedule Interview</summary>
                        <form action={reviewCPApplicationAction} style={{ marginTop: 10 }}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="action" value="schedule_interview" />
                          <label className="form-label" style={{ marginTop: 0 }}>
                            Interview Date &amp; Time
                            <input className="input" type="datetime-local" name="scheduledAt" required />
                          </label>
                          <label className="form-label">
                            Notes (optional)
                            <input className="input" name="notes" placeholder="e.g. Zoom link, agenda..." />
                          </label>
                          <button className="button secondary" type="submit" style={{ fontSize: 13 }}>Schedule</button>
                        </form>
                      </details>

                      {app.status === "INTERVIEW_SCHEDULED" && (
                        <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Mark Interview Complete</summary>
                          <form action={reviewCPApplicationAction} style={{ marginTop: 10 }}>
                            <input type="hidden" name="applicationId" value={app.id} />
                            <input type="hidden" name="action" value="mark_interview_complete" />
                            <label className="form-label" style={{ marginTop: 0 }}>
                              Notes (optional)
                              <input className="input" name="notes" placeholder="Interview summary..." />
                            </label>
                            <button className="button secondary" type="submit" style={{ fontSize: 13 }}>Mark Complete</button>
                          </form>
                        </details>
                      )}

                      <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#16a34a" }}>Approve Application</summary>
                        <form action={reviewCPApplicationAction} style={{ marginTop: 10 }}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="action" value="approve" />
                          <label className="form-label" style={{ marginTop: 0 }}>
                            Notes (optional)
                            <textarea className="input" name="notes" rows={2} placeholder="Any notes for the new chapter president..." />
                          </label>
                          <button className="button" type="submit" style={{ fontSize: 13, background: "#16a34a" }}>
                            Approve &amp; Assign as Chapter Lead
                          </button>
                        </form>
                      </details>

                      <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626" }}>Reject Application</summary>
                        <form action={reviewCPApplicationAction} style={{ marginTop: 10 }}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="action" value="reject" />
                          <label className="form-label" style={{ marginTop: 0 }}>
                            Reason <span style={{ color: "#dc2626" }}>*</span>
                            <textarea className="input" name="reason" required rows={3} placeholder="Explain why the application is being rejected..." />
                          </label>
                          <button className="button" type="submit" style={{ fontSize: 13, background: "#dc2626" }}>Reject Application</button>
                        </form>
                      </details>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
