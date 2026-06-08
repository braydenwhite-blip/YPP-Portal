import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getClassReports } from "@/lib/class-reports";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { StatCard } from "@/components/people-strategy/stat-card";
import { Meter, SuiteChip } from "@/components/people-strategy/people-suite";
import { StarRating } from "@/components/classes/star-rating";
import { REPEAT_RECOMMENDATION_LABELS } from "@/lib/class-feedback-constants";

export const dynamic = "force-dynamic";

const DELIVERY_LABEL: Record<string, string> = {
  VIRTUAL: "Online",
  IN_PERSON: "In person",
  HYBRID: "Hybrid",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2 className="section-title" style={{ margin: "0 0 2px" }}>
        {title}
      </h2>
      {subtitle ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)" }}>{subtitle}</p>
      ) : (
        <div style={{ height: 8 }} />
      )}
      {children}
    </section>
  );
}

export default async function AdminClassReportsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const reports = await getClassReports();
  const { pipeline, enrollment, upcoming, subjects, instructors, feedback } = reports;
  const maxSubjectEnroll = Math.max(1, ...subjects.map((s) => s.enrollmentCount));

  return (
    <div className="ps-page psuite">
      <ActionCommandBar
        eyebrow="Admin · Class Reports"
        title="Class Reports"
        subtitle="How the class program is doing right now — pipeline, enrollment health, subject demand, and who's teaching. Every number is live; nothing is estimated."
        meta={`${reports.totalClasses} classes · as of ${reports.generatedAt.toLocaleString()}`}
      />

      <div style={{ margin: "12px 0 18px" }}>
        <Link href="/admin/classes" className="button" style={{ fontSize: 13 }}>
          ← Class operations
        </Link>
      </div>

      {reports.totalClasses === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">📊</div>
          <h3 style={{ marginTop: 0 }}>No classes yet</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 460, margin: "8px auto 16px" }}>
            Reports will populate here as instructors propose classes and students enroll. Create
            the first class to get started.
          </p>
          <Link href="/admin/classes" className="button primary">
            Go to class operations
          </Link>
        </div>
      ) : (
        <>
          {/* 1 — Pipeline */}
          <SectionCard
            title="Class pipeline"
            subtitle="Where every class sits on the path from idea to completed."
          >
            <div className="psuite-stat-strip">
              <StatCard label="Drafts" value={pipeline.draft} icon="layers" />
              <StatCard
                label="Needs review"
                value={pipeline.needsReview}
                icon="clock"
                tone={pipeline.needsReview > 0 ? "warning" : "default"}
                href="/admin/classes?tab=review"
              />
              <StatCard
                label="Ready to publish"
                value={pipeline.approvedNotPublished}
                icon="check"
                tone={pipeline.approvedNotPublished > 0 ? "accent" : "default"}
                href="/admin/classes?tab=ready"
              />
              <StatCard label="Published" value={pipeline.published} icon="check" tone="success" />
              <StatCard label="In session" value={pipeline.inProgress} icon="activity" />
              <StatCard label="Completed" value={pipeline.completed} icon="flag" />
              <StatCard label="Cancelled" value={pipeline.cancelled} icon="alert" />
            </div>
          </SectionCard>

          {/* 2 — Enrollment health */}
          <SectionCard
            title="Enrollment health"
            subtitle="Across published and in-session classes."
          >
            <div className="psuite-stat-strip">
              <StatCard label="Active enrollments" value={enrollment.totalActive} icon="users" tone="success" />
              <StatCard
                label="Avg per class"
                value={enrollment.publishedClasses > 0 ? enrollment.avgPerClass.toFixed(1) : "—"}
                icon="activity"
              />
              <StatCard label="Full classes" value={enrollment.fullClasses} icon="check" />
              <StatCard
                label="Under-enrolled"
                value={enrollment.underEnrolledClasses}
                icon="alert"
                tone={enrollment.underEnrolledClasses > 0 ? "warning" : "default"}
              />
              <StatCard label="On waitlists" value={enrollment.totalWaitlisted} icon="clock" />
              {feedback.avgRating !== null ? (
                <StatCard
                  label="Avg satisfaction"
                  value={`${feedback.avgRating.toFixed(1)}★`}
                  icon="check"
                  tone="accent"
                  hint={`${feedback.totalResponses} response${feedback.totalResponses === 1 ? "" : "s"}`}
                />
              ) : null}
            </div>
            {enrollment.totalCapacity > 0 ? (
              <div style={{ marginTop: 14, maxWidth: 460 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Capacity utilization</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {enrollment.totalActive} / {enrollment.totalCapacity} seats · {pct(enrollment.capacityUtilization)}
                  </span>
                </div>
                <Meter
                  value={enrollment.totalActive}
                  max={enrollment.totalCapacity}
                  tone={enrollment.capacityUtilization >= 0.85 ? "warning" : "accent"}
                />
              </div>
            ) : null}
          </SectionCard>

          {/* 3 — Upcoming starts */}
          <SectionCard
            title="Starting soon"
            subtitle="Live classes starting in the next two weeks, flagged for anything that still needs attention."
          >
            {upcoming.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                No classes start in the next two weeks.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#faf5ff", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Class</th>
                      <th style={{ padding: "8px 10px" }}>Starts</th>
                      <th style={{ padding: "8px 10px" }}>Instructor</th>
                      <th style={{ padding: "8px 10px" }}>Format</th>
                      <th style={{ padding: "8px 10px" }}>Enrollment</th>
                      <th style={{ padding: "8px 10px" }}>Needs attention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                          <Link href={`/admin/classes/${u.id}`}>{u.title}</Link>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {u.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{u.instructorName}</td>
                        <td style={{ padding: "8px 10px" }}>{DELIVERY_LABEL[u.deliveryMode] ?? u.deliveryMode}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {u.enrolledCount} / {u.capacity}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {u.missingMeetingLink ? (
                              <span className="pill" style={{ background: "#fef2f2", color: "#dc2626", fontWeight: 600, fontSize: 11 }}>
                                No meeting link
                              </span>
                            ) : null}
                            {u.lowEnrollment ? (
                              <span className="pill" style={{ background: "#fffbeb", color: "#b45309", fontWeight: 600, fontSize: 11 }}>
                                Low enrollment
                              </span>
                            ) : null}
                            {!u.missingMeetingLink && !u.lowEnrollment ? (
                              <span style={{ color: "#16a34a", fontSize: 12 }}>On track</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* 4 — Subject demand */}
          <SectionCard
            title="Subject demand"
            subtitle="Which subjects draw the most enrollment."
          >
            {subjects.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>Not enough data yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {subjects.map((s) => (
                  <div key={s.interestArea} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 160, fontSize: 13, fontWeight: 600 }}>{s.interestArea}</div>
                    <div style={{ flex: 1 }}>
                      <Meter value={s.enrollmentCount} max={maxSubjectEnroll} tone="accent" />
                    </div>
                    <div style={{ width: 150, fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>
                      {s.enrollmentCount} enrolled · {s.classCount} class{s.classCount === 1 ? "" : "es"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* 5 — Instructor teaching */}
          <SectionCard
            title="Instructor teaching"
            subtitle="Who's actively teaching and what they've completed."
          >
            {instructors.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                No instructors are teaching live classes yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {instructors.map((i) => (
                  <div
                    key={i.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      flexWrap: "wrap",
                    }}
                  >
                    <Link href={`/admin/instructors/${i.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                      {i.name}
                    </Link>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <SuiteChip>{i.activeClasses} active</SuiteChip>
                      {i.completedClasses > 0 ? <SuiteChip muted>{i.completedClasses} completed</SuiteChip> : null}
                      <SuiteChip muted>{i.totalEnrollments} students</SuiteChip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* 6 — Got good feedback / repeat these */}
          <SectionCard
            title="Got good feedback · repeat these"
            subtitle="Classes worth running again — strong student feedback and the team's repeat calls — plus completed classes still waiting on an outcome."
          >
            {feedback.goodFeedback.length === 0 &&
            feedback.repeatPlan.length === 0 &&
            feedback.needsOutcomeReview.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                Nothing here yet. As classes wrap up, the ones students rate highly and
                the ones the team marks to repeat will surface here.
              </p>
            ) : (
              <>
                <div className="grid two" style={{ gap: 18, alignItems: "start" }}>
                  {/* Good feedback */}
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>
                      Got good feedback
                    </div>
                    {feedback.goodFeedback.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                        No standout feedback yet.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {feedback.goodFeedback.slice(0, 8).map((row) => (
                          <div
                            key={row.offeringId}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom: "1px solid var(--border)",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <Link
                                href={`/admin/classes/${row.offeringId}`}
                                style={{ fontWeight: 600, fontSize: 14 }}
                              >
                                {row.title}
                              </Link>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                {row.instructorName} · {row.interestArea}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {row.responseCount > 0 ? (
                                <>
                                  <StarRating value={Math.round(row.avgRating)} size={13} />
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                    {row.avgRating.toFixed(1)} ({row.responseCount})
                                  </span>
                                </>
                              ) : (
                                <SuiteChip>Flagged</SuiteChip>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Repeat plan */}
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>
                      Repeat plan
                    </div>
                    {feedback.repeatPlan.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                        No repeat calls recorded yet. Set one on a class&apos;s detail page.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {feedback.repeatPlan.slice(0, 8).map((row) => (
                          <div
                            key={row.offeringId}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom: "1px solid var(--border)",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <Link
                                href={`/admin/classes/${row.offeringId}`}
                                style={{ fontWeight: 600, fontSize: 14 }}
                              >
                                {row.title}
                              </Link>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                {row.instructorName}
                                {row.responseCount > 0
                                  ? ` · ${row.avgRating.toFixed(1)}★ (${row.responseCount})`
                                  : ""}
                              </div>
                            </div>
                            {row.repeatRecommendation ? (
                              <span
                                className="pill"
                                style={{
                                  background: "#faf5ff",
                                  color: "#6b21c8",
                                  fontWeight: 600,
                                  fontSize: 11,
                                }}
                              >
                                {REPEAT_RECOMMENDATION_LABELS[row.repeatRecommendation]}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {feedback.needsOutcomeReview.length > 0 ? (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <div className="section-title" style={{ marginBottom: 6 }}>
                      Needs an outcome ({feedback.needsOutcomeReview.length})
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-secondary)" }}>
                      Completed classes with no recorded outcome yet. Record one to close
                      the loop and feed the repeat plan.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {feedback.needsOutcomeReview.slice(0, 12).map((row) => (
                        <Link
                          key={row.offeringId}
                          href={`/admin/classes/${row.offeringId}`}
                          className="pill"
                          style={{
                            background: "#fffbeb",
                            color: "#b45309",
                            fontWeight: 600,
                            fontSize: 12,
                            textDecoration: "none",
                          }}
                        >
                          {row.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
