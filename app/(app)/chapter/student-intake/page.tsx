import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  approveStudentIntakeCase,
  getStudentIntakeCasesForReview,
  rejectStudentIntakeCase,
  updateStudentIntakeCaseStatus,
} from "@/lib/student-intake-actions";
import { getStudentIntakeStatusMeta } from "@/lib/student-intake-shared";

function formatAge(from: Date) {
  const diffHours = (Date.now() - from.getTime()) / 36e5;
  if (diffHours < 1) {
    return `${Math.max(1, Math.round(diffHours * 60))}m`;
  }
  if (diffHours < 24) {
    return `${diffHours.toFixed(diffHours >= 10 ? 0 : 1)}h`;
  }
  const days = diffHours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

export default async function ChapterStudentIntakePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    redirect("/");
  }

  const intakeCases = await getStudentIntakeCasesForReview();

  return (
    <main className="main-content">
      <div className="topbar">
        <div>
          <Link href="/chapter" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Chapter OS
          </Link>
          <h1 className="page-title">Student Intake Board</h1>
          <p className="page-subtitle">
            Review parent-led student journeys, move them through chapter review, and launch the first support plan.
          </p>
        </div>
      </div>

      {intakeCases.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>No student intake cases are waiting right now</h3>
          <p style={{ color: "var(--muted)", maxWidth: 560, margin: "0 auto" }}>
            New parent-led student journeys will appear here once families submit them from the parent portal.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {intakeCases.map((intakeCase) => {
            const statusMeta = getStudentIntakeStatusMeta(intakeCase.status);
            const latestMilestone = intakeCase.milestones[intakeCase.milestones.length - 1] ?? null;

            return (
              <section
                key={intakeCase.id}
                id={`case-${intakeCase.id}`}
                className="card"
                style={{ borderLeft: `4px solid ${statusMeta.color}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{intakeCase.studentName}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
                      {intakeCase.parent.name} · {intakeCase.parent.email} · {intakeCase.chapter.name}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="pill" style={{ background: statusMeta.background, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                    <span className="pill">Age: {formatAge(intakeCase.submittedAt ?? intakeCase.createdAt)}</span>
                  </div>
                </div>

                <div className="grid two" style={{ marginTop: 16, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Student profile</div>
                      <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                        <div><strong>Email:</strong> {intakeCase.studentEmail}</div>
                        <div><strong>Grade:</strong> {intakeCase.studentGrade ?? "Not added"}</div>
                        <div><strong>School:</strong> {intakeCase.studentSchool || "Not added"}</div>
                        <div><strong>Relationship:</strong> {intakeCase.relationship}</div>
                        <div><strong>Owner:</strong> {intakeCase.reviewOwner?.name ?? "Not assigned yet"}</div>
                        <div><strong>Next action:</strong> {intakeCase.nextAction || "Open and review"}</div>
                        <div><strong>Blocker:</strong> {intakeCase.blockerNote || "None"}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Interests</div>
                      {intakeCase.interests.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {intakeCase.interests.map((interest) => (
                            <span key={interest} className="pill">
                              {interest}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>No interests listed.</div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Goals</div>
                      {intakeCase.goals.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)" }}>
                          {intakeCase.goals.map((goal) => (
                            <li key={goal}>{goal}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>No goals listed.</div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Support needs</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                        {intakeCase.supportNeeds || "No support needs listed."}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Parent notes</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                        {intakeCase.parentNotes || "No extra parent notes."}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Parent-facing milestone</div>
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "var(--surface-alt)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <strong style={{ display: "block", color: "var(--foreground)" }}>
                          {latestMilestone?.title ?? "No milestone yet"}
                        </strong>
                        {latestMilestone?.body ? <span>{latestMilestone.body}</span> : null}
                      </div>
                    </div>

                    <form style={{ display: "grid", gap: 10 }}>
                      <input type="hidden" name="id" value={intakeCase.id} />

                      <label className="form-label" style={{ marginTop: 0 }}>
                        Reviewer note
                        <textarea
                          className="input"
                          name="reviewerNote"
                          rows={3}
                          defaultValue={intakeCase.reviewerNote || ""}
                          placeholder="Internal review note for the chapter team..."
                        />
                      </label>

                      <label className="form-label" style={{ marginTop: 0 }}>
                        Next action
                        <input
                          className="input"
                          name="nextAction"
                          defaultValue={intakeCase.nextAction || ""}
                          placeholder="What should happen next?"
                        />
                      </label>

                      <label className="form-label" style={{ marginTop: 0 }}>
                        Blocker note
                        <textarea
                          className="input"
                          name="blockerNote"
                          rows={2}
                          defaultValue={intakeCase.blockerNote || ""}
                          placeholder="Anything blocking approval or follow-through?"
                        />
                      </label>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="submit"
                          formAction={updateStudentIntakeCaseStatus}
                          name="status"
                          value="UNDER_REVIEW"
                          className="button secondary"
                        >
                          Save / Move To Review
                        </button>
                        <button type="submit" formAction={approveStudentIntakeCase} className="button">
                          Approve And Launch Plan
                        </button>
                        <button type="submit" formAction={rejectStudentIntakeCase} className="button secondary">
                          Reject
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
