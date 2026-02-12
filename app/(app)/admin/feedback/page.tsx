import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { giveFeedback, updateCycleStatus } from "@/lib/feedback-actions";

export default async function AdminFeedbackPage() {
  const session = await getServerSession(authOptions);
  const roles: string[] = (session?.user as any)?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR")) {
    redirect("/");
  }

  const cycles = await prisma.projectFeedbackCycle.findMany({
    include: {
      feedback: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { givenAt: "desc" },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Project Feedback</h1>
        </div>
      </div>

      {cycles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 32px" }}>
          <p style={{ color: "var(--text-secondary)" }}>No feedback cycles yet. Students can submit work for feedback from the Project Feedback page.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {cycles.map((cycle) => (
            <div key={cycle.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>Cycle #{cycle.cycleNumber} — Project {cycle.projectId.substring(0, 8)}...</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    Submitted {new Date(cycle.submittedAt).toLocaleDateString()}
                  </div>
                </div>
                <form action={updateCycleStatus} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <input type="hidden" name="id" value={cycle.id} />
                  <select className="input" name="status" defaultValue={cycle.status} style={{ fontSize: 13, padding: "4px 8px" }}>
                    <option value="AWAITING_FEEDBACK">Awaiting Feedback</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                  <button className="button small" type="submit">Save</button>
                </form>
              </div>

              {cycle.studentReflection && (
                <div style={{ backgroundColor: "var(--bg-secondary)", padding: 12, borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Student Reflection</div>
                  <p style={{ fontSize: 14 }}>{cycle.studentReflection}</p>
                </div>
              )}

              {cycle.workSamples.length > 0 && (
                <div style={{ fontSize: 14, marginBottom: 12, color: "var(--text-secondary)" }}>
                  Work samples: {cycle.workSamples.length} file{cycle.workSamples.length !== 1 ? "s" : ""}
                </div>
              )}

              {/* Existing feedback */}
              {cycle.feedback.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>Feedback ({cycle.feedback.length})</h4>
                  {cycle.feedback.map((fb) => (
                    <div key={fb.id} style={{ backgroundColor: "var(--bg-secondary)", padding: 12, borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {fb.reviewer.name} ({fb.reviewerType})
                      </div>
                      <p style={{ fontSize: 14, marginBottom: 4 }}>
                        <strong style={{ color: "#10b981" }}>Strengths:</strong> {fb.strengths}
                      </p>
                      <p style={{ fontSize: 14 }}>
                        <strong style={{ color: "#f59e0b" }}>Improve:</strong> {fb.improvements}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add feedback form */}
              {cycle.status !== "COMPLETED" && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--primary-color)" }}>
                    + Give Feedback
                  </summary>
                  <form action={giveFeedback} className="form-grid" style={{ marginTop: 12 }}>
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <label className="form-row">
                      Strengths
                      <textarea className="input" name="strengths" rows={2} required placeholder="What the student did well..." />
                    </label>
                    <label className="form-row">
                      Areas for Improvement
                      <textarea className="input" name="improvements" rows={2} required placeholder="What could be better..." />
                    </label>
                    <label className="form-row">
                      Suggestions (optional)
                      <textarea className="input" name="suggestions" rows={2} placeholder="Specific next steps..." />
                    </label>
                    <label className="form-row">
                      Encouragement
                      <textarea className="input" name="encouragement" rows={2} required placeholder="A motivating closing message..." />
                    </label>
                    <button className="button" type="submit">Submit Feedback</button>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
