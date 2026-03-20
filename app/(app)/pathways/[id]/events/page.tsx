import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EventRegistrationButton } from "./event-registration-client";
import { getCourseBackedPathwayStepsThroughOrder } from "@/lib/pathway-logic";

export default async function PathwayEventsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true },
  });

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      steps: {
        select: { courseId: true, stepOrder: true, title: true },
        orderBy: { stepOrder: "asc" },
      },
    },
  });
  if (!pathway) notFound();

  const chapterConfig = viewer?.chapterId
    ? await prisma.chapterPathway.findUnique({
        where: {
          chapterId_pathwayId: {
            chapterId: viewer.chapterId,
            pathwayId: pathway.id,
          },
        },
        select: { isAvailable: true },
      })
    : null;

  // Load pathway events
  const events = await prisma.pathwayEvent.findMany({
    where: { pathwayId: params.id },
    include: {
      registrations: { where: { userId }, select: { id: true } },
      _count: {
        select: { registrations: true },
      },
    },
    orderBy: { eventDate: "asc" },
  }).catch(() => [] as any[]);

  // Get user's highest completed step
  const courseIds = pathway.steps.map((s) => s.courseId).filter((id): id is string => id !== null);
  const completedEnrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: courseIds }, status: "COMPLETED" },
    select: { courseId: true },
  });
  const completedCourseIds = new Set(completedEnrollments.map((e) => e.courseId));
  const hasPathwayEnrollment =
    courseIds.length > 0
      ? Boolean(
          await prisma.enrollment.findFirst({
            where: { userId, courseId: { in: courseIds } },
            select: { id: true },
          })
        )
      : false;

  if ((chapterConfig?.isAvailable ?? true) === false && !hasPathwayEnrollment) {
    notFound();
  }

  const now = new Date();

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">Pathway Events</h1>
          <p className="page-subtitle">Milestone workshops and events for {pathway.name}. Registration opens once the required course steps are complete.</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="card">
          <h3>No events scheduled yet</h3>
          <p style={{ color: "var(--gray-500)" }}>
            Your chapter admin will schedule workshops and milestone events for this pathway.
            Check back soon!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {events.map((event: any) => {
            const isPast = event.eventDate && new Date(event.eventDate) < now;
            const isRegistered = event.registrations.length > 0;
            const requiredStep = event.requiredStepOrder ?? 0;
            const hasMatchingRequiredStep =
              requiredStep === 0 ||
              pathway.steps.some((step) => step.stepOrder === requiredStep);
            const requiredCourseSteps =
              requiredStep > 0
                ? getCourseBackedPathwayStepsThroughOrder(pathway.steps, requiredStep)
                : [];
            const canRegister =
              hasMatchingRequiredStep &&
              requiredCourseSteps.every((step) =>
                completedCourseIds.has(step.courseId)
              );
            const isFull =
              event.maxAttendees != null &&
              event._count.registrations >= event.maxAttendees;

            return (
              <div
                key={event.id}
                className="card"
                style={{
                  opacity: isPast ? 0.7 : 1,
                  borderLeft: `4px solid ${isPast ? "var(--gray-300)" : isRegistered ? "var(--green-500, #48bb78)" : "var(--ypp-purple)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{event.title}</h3>
                    {event.description && (
                      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--gray-600)" }}>{event.description}</p>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                      {event.eventDate && (
                        <span className="pill">
                          {new Date(event.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      {event.locationOrLink && (
                        <span className="pill">{event.locationOrLink}</span>
                      )}
                      {event.maxAttendees && (
                        <span className="pill">
                          {event._count.registrations} / {event.maxAttendees} registered
                        </span>
                      )}
                      {requiredStep > 0 && (
                        <span
                          className="pill"
                          style={canRegister
                            ? { background: "var(--green-50, #f0fff4)", color: "var(--green-700, #276749)" }
                            : { background: "var(--red-50, #fff5f5)", color: "var(--red-700, #c53030)" }}
                        >
                          {canRegister ? "✓ Unlocked" : `Finish course steps through Step ${requiredStep}`}
                        </span>
                      )}
                      {isPast && <span className="pill" style={{ color: "var(--gray-400)" }}>Past</span>}
                    </div>
                  </div>

                  {!isPast && (
                    <EventRegistrationButton
                      eventId={event.id}
                      isRegistered={isRegistered}
                      canRegister={canRegister}
                      isFull={isFull}
                      requiredStep={requiredStep}
                    />
                  )}
                  {isPast && isRegistered && (
                    <span className="pill" style={{ background: "var(--green-50, #f0fff4)", color: "var(--green-700, #276749)" }}>
                      Attended
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
