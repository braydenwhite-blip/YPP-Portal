import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { getParentStudentIntakeCase, submitStudentIntakeCase } from "@/lib/student-intake-actions";
import { getStudentIntakeStatusMeta } from "@/lib/student-intake-shared";

export default async function ParentStudentIntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  const intakeCase = await getParentStudentIntakeCase(id);
  if (!intakeCase) {
    notFound();
  }

  const statusMeta = getStudentIntakeStatusMeta(intakeCase.status);

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <Link href="/parent" style={{ fontSize: 13, color: "var(--muted)" }}>
            &larr; Parent Portal
          </Link>
          <h1 className="page-title">{intakeCase.studentName}</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Step 2: review the case, then follow the milestone timeline as the chapter moves it forward.
          </p>
        </div>
        <span
          className="pill"
          style={{ background: statusMeta.background, color: statusMeta.color, fontSize: 12, height: "fit-content" }}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Student details</h3>
            <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
              <div>
                <strong>Email:</strong> {intakeCase.studentEmail}
              </div>
              <div>
                <strong>Chapter:</strong> {intakeCase.chapter.name}
              </div>
              <div>
                <strong>Relationship:</strong> {intakeCase.relationship}
              </div>
              <div>
                <strong>Grade:</strong> {intakeCase.studentGrade ?? "Not added yet"}
              </div>
              <div>
                <strong>School:</strong> {intakeCase.studentSchool || "Not added yet"}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Profile and goals</h3>

            <div style={{ marginBottom: 14 }}>
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
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No interests added yet.</div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Goals</div>
              {intakeCase.goals.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)" }}>
                  {intakeCase.goals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No goals added yet.</div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Support needs</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {intakeCase.supportNeeds || "No support needs added yet."}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Parent notes</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {intakeCase.parentNotes || "No extra notes added yet."}
              </div>
            </div>
          </div>

          {intakeCase.status === "DRAFT" ? (
            <div
              className="card"
              style={{ borderLeft: "4px solid var(--ypp-purple)" }}
            >
              <h3 style={{ marginTop: 0 }}>Ready to submit?</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                When you submit, the chapter team sees the case in its review board. From there, you can track milestones here.
              </p>
              <form action={submitStudentIntakeCase}>
                <input type="hidden" name="id" value={intakeCase.id} />
                <button type="submit" className="button">
                  Submit To Chapter Review
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Milestone timeline</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {intakeCase.milestones.map((milestone, index) => {
                const milestoneMeta = getStudentIntakeStatusMeta(milestone.status);

                return (
                  <div key={milestone.id} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: milestoneMeta.color,
                          marginTop: 4,
                        }}
                      />
                      {index < intakeCase.milestones.length - 1 ? (
                        <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 30 }} />
                      ) : null}
                    </div>

                    <div style={{ paddingBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{milestone.title}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                        {new Date(milestone.createdAt).toLocaleString()}
                      </div>
                      {milestone.body ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                          {milestone.body}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>What happens next?</h3>
            <div style={{ display: "grid", gap: 10, fontSize: 14, color: "var(--text-secondary)" }}>
              <div>1. The chapter reviews the student profile, goals, and support needs.</div>
              <div>2. If approved, the student account is created or linked and the parent connection is activated.</div>
              <div>3. The chapter launches the first mentorship action plan before assigning the long-term mentor.</div>
            </div>
            {intakeCase.studentUser ? (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  color: "#166534",
                }}
              >
                Student account linked: {intakeCase.studentUser.email}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
