import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ReflectionForm } from "./reflection-form";

export default async function PathwayJournalPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    include: {
      steps: { include: { course: { select: { title: true } } }, orderBy: { stepOrder: "asc" } },
    },
  });
  if (!pathway) notFound();

  // Load user's reflections for this pathway
  const reflections = await prisma.pathwayReflection.findMany({
    where: { userId, pathwayId: params.id },
    orderBy: { createdAt: "desc" },
  }).catch(() => [] as any[]);

  // Load user's completed steps to know which steps can have a reflection
  const courseIds = pathway.steps.map((s) => s.courseId);
  const completedEnrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: courseIds }, status: "COMPLETED" },
    select: { courseId: true },
  });
  const completedCourseIds = new Set(completedEnrollments.map((e) => e.courseId));

  const completedSteps = pathway.steps.filter((s) => completedCourseIds.has(s.courseId));
  const reflectedStepOrders = new Set(reflections.map((r: any) => r.stepOrder));

  // Steps that are completed but don't have a reflection yet
  const pendingReflectionSteps = completedSteps.filter((s) => !reflectedStepOrders.has(s.stepOrder));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">My Reflections</h1>
          <p className="page-subtitle">Your learning journal for {pathway.name}</p>
        </div>
      </div>

      {/* Pending reflections prompt */}
      {pendingReflectionSteps.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--ypp-purple)" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Steps awaiting reflection</h3>
          <p style={{ fontSize: 14, color: "var(--gray-600)", marginBottom: 16 }}>
            Write a short reflection on each step you completed. What did you learn? What surprised you?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingReflectionSteps.map((step) => (
              <ReflectionForm
                key={step.id}
                pathwayId={params.id}
                stepOrder={step.stepOrder}
                stepTitle={step.course.title}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past reflections timeline */}
      <div>
        <div className="section-title">Reflection Timeline</div>
        {reflections.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--gray-500)" }}>
              No reflections yet. Complete a pathway step and write your first reflection above.
            </p>
          </div>
        ) : (
          <div className="timeline">
            {reflections.map((reflection: any) => {
              const step = pathway.steps.find((s) => s.stepOrder === reflection.stepOrder);
              return (
                <div key={reflection.id} className="timeline-item" style={{ paddingBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>
                      Step {reflection.stepOrder}{step ? `: ${step.course.title}` : ""}
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                      {new Date(reflection.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--gray-700)", margin: 0, whiteSpace: "pre-wrap" }}>
                    {reflection.content}
                  </p>
                  {!reflection.visibleToMentor && (
                    <span style={{ fontSize: 11, color: "var(--gray-400)" }}>Private — not shared with mentor</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
