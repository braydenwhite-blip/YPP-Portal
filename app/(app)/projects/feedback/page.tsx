import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";

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

  if (cycles.length === 0) {
    return (
      <EmptyState
        icon="🔄"
        badge="Feedback"
        title="Project Feedback"
        description="This page will let you share your work at key milestones and get constructive feedback from mentors, instructors, or peers to refine your projects."
        addedBy="students (submissions) and mentors/instructors (feedback)"
        actionLabel="Go to Admin Panel"
        actionHref="/admin"
      />
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Feedback</p>
          <h1 className="page-title">Project Feedback</h1>
        </div>
      </div>

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
                    <p style={{ fontSize: 14 }}>
                      <strong style={{ color: "#f59e0b" }}>Improve:</strong> {fb.improvements}
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
    </div>
  );
}
