import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ReflectionForm } from "./reflection-form";
import { getSingleStudentPathwayJourney } from "@/lib/chapter-pathway-journey";

function getStepTitle(step: {
  title: string | null;
  classTemplate?: { title: string | null } | null;
  course?: { title: string | null } | null;
  stepOrder: number;
}) {
  return step.classTemplate?.title?.trim() || step.course?.title?.trim() || step.title?.trim() || `Step ${step.stepOrder}`;
}

export default async function PathwayJournalPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [pathway, pathwayJourney] = await Promise.all([
    prisma.pathway.findUnique({
      where: { id: params.id },
      include: {
        steps: {
          include: {
            course: { select: { title: true } },
            classTemplate: { select: { title: true } },
          },
          orderBy: { stepOrder: "asc" },
        },
      },
    }),
    getSingleStudentPathwayJourney(userId, params.id),
  ]);

  if (!pathway || !pathwayJourney) notFound();
  if (!pathwayJourney.isVisibleInChapter && !pathwayJourney.isEnrolled && !pathwayJourney.isComplete) {
    notFound();
  }

  const reflections = await prisma.pathwayReflection.findMany({
    where: { userId, pathwayId: params.id },
    orderBy: { createdAt: "desc" },
  }).catch(() => [] as any[]);

  const completedStepOrders = new Set(
    pathwayJourney.steps.filter((step) => step.status === "COMPLETED").map((step) => step.stepOrder)
  );
  const reflectedStepOrders = new Set(reflections.map((reflection: any) => reflection.stepOrder));

  const pendingReflectionSteps = pathway.steps.filter(
    (step) => completedStepOrders.has(step.stepOrder) && !reflectedStepOrders.has(step.stepOrder)
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← {pathway.name}
          </Link>
          <h1 className="page-title">My Reflections</h1>
          <p className="page-subtitle">
            Your learning journal for {pathway.name}. Reflections unlock after you complete a mapped
            class step.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Journal status</h3>
        <div className="grid three" style={{ gap: 12 }}>
          <div>
            <div className="kpi">{pathwayJourney.completedCount}</div>
            <div className="kpi-label">Completed steps</div>
          </div>
          <div>
            <div className="kpi">{reflections.length}</div>
            <div className="kpi-label">Reflections written</div>
          </div>
          <div>
            <div className="kpi">{pendingReflectionSteps.length}</div>
            <div className="kpi-label">Still waiting</div>
          </div>
        </div>
      </div>

      {pendingReflectionSteps.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--ypp-purple)" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Steps awaiting reflection</h3>
          <p style={{ fontSize: 14, color: "var(--gray-600)", marginBottom: 16 }}>
            Write a short reflection on each completed class step. What did you learn, what surprised
            you, and what will you apply next?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingReflectionSteps.map((step) => (
              <ReflectionForm
                key={step.id}
                pathwayId={params.id}
                stepOrder={step.stepOrder}
                stepTitle={getStepTitle(step)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-title">Reflection Timeline</div>
        {reflections.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--gray-500)" }}>
              No reflections yet. Complete a class step and your next reflection form will appear above.
            </p>
          </div>
        ) : (
          <div className="timeline">
            {reflections.map((reflection: any) => {
              const step = pathway.steps.find((candidate) => candidate.stepOrder === reflection.stepOrder);
              return (
                <div key={reflection.id} className="timeline-item" style={{ paddingBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>
                      Step {reflection.stepOrder}
                      {step ? `: ${getStepTitle(step)}` : ""}
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
                      {new Date(reflection.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--gray-700)", margin: 0, whiteSpace: "pre-wrap" }}>
                    {reflection.content}
                  </p>
                  {!reflection.visibleToMentor && (
                    <span style={{ fontSize: 11, color: "var(--gray-400)" }}>
                      Private - not shared with mentor
                    </span>
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
