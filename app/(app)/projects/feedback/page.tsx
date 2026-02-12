import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createFeedbackCycle } from "@/lib/feedback-actions";

export default async function ProjectFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const cycles = await prisma.projectFeedbackCycle.findMany({
    include: {
      feedback: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { givenAt: "desc" },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Feedback</p>
          <h1 className="page-title">Project Feedback</h1>
        </div>
      </div>

      {/* Submit work form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Submit Work for Feedback</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
          Share your work at a key milestone and get constructive feedback from mentors, instructors, or peers.
        </p>
        <form action={createFeedbackCycle} className="form-grid">
          <label className="form-row">
            Project ID
            <input className="input" name="projectId" required placeholder="Your project/passion ID" />
          </label>
          <label className="form-row">
            Your Reflection
            <textarea
              className="input"
              name="studentReflection"
              rows={3}
              required
              placeholder="What have you been working on? What are you proud of? Where do you need help?"
            />
          </label>
          <label className="form-row">
            Work Sample URLs (one per line)
            <textarea
              className="input"
              name="workSamples"
              rows={2}
              placeholder={"https://example.com/my-project\nhttps://photos.example.com/screenshot.png"}
            />
          </label>
          <button className="button" type="submit">Submit for Feedback</button>
        </form>
      </div>

      {/* Existing cycles */}
      {cycles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 32px", color: "var(--text-secondary)" }}>
          <p>No feedback cycles yet. Submit your work above to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {cycles.map((cycle) => (
            <div key={cycle.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>Feedback Cycle #{cycle.cycleNumber}</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    Submitted {new Date(cycle.submittedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="pill secondary">{cycle.status}</span>
              </div>
              {cycle.studentReflection && (
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                  {cycle.studentReflection}
                </p>
              )}
              {cycle.feedback.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  {cycle.feedback.map((fb) => (
                    <div key={fb.id} style={{ backgroundColor: "var(--bg-secondary)", padding: 12, borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
                        {fb.reviewer.name} ({fb.reviewerType})
                      </div>
                      <p style={{ fontSize: 14, marginBottom: 4 }}>
                        <strong style={{ color: "#10b981" }}>Strengths:</strong> {fb.strengths}
                      </p>
                      <p style={{ fontSize: 14, marginBottom: 4 }}>
                        <strong style={{ color: "#f59e0b" }}>Improve:</strong> {fb.improvements}
                      </p>
                      {fb.suggestions && (
                        <p style={{ fontSize: 14, marginBottom: 4 }}>
                          <strong>Suggestions:</strong> {fb.suggestions}
                        </p>
                      )}
                      <p style={{ fontSize: 14, fontStyle: "italic", color: "var(--text-secondary)" }}>
                        {fb.encouragement}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: "var(--bg-secondary)", padding: 12, borderRadius: 8, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
                  Awaiting feedback...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
