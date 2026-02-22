import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EventRegistrationButton } from "./event-registration-client";

export default async function PathwayEventsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, steps: { select: { courseId: true, stepOrder: true }, orderBy: { stepOrder: "asc" } } },
  });
  if (!pathway) notFound();

  // Load pathway events
  const events = await prisma.pathwayEvent.findMany({
    where: { pathwayId: params.id },
    include: { registrations: { where: { userId }, select: { id: true } } },
    orderBy: { eventDate: "asc" },
  }).catch(() => [] as any[]);

  // Get user's highest completed step
  const courseIds = pathway.steps.map((s) => s.courseId);
  const completedEnrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: courseIds }, status: "COMPLETED" },
    select: { courseId: true },
  });
  const completedCourseIds = new Set(completedEnrollments.map((e) => e.courseId));
  const maxCompletedStep = pathway.steps.reduce((max, step) => {
    return completedCourseIds.has(step.courseId) ? Math.max(max, step.stepOrder) : max;
  }, 0);

  const now = new Date();

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">Pathway Events</h1>
          <p className="page-subtitle">Milestone workshops and events for {pathway.name}</p>
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
            const canRegister = maxCompletedStep >= requiredStep;

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
                        <span className="pill">{event.maxAttendees} max attendees</span>
                      )}
                      {requiredStep > 0 && (
                        <span
                          className="pill"
                          style={canRegister
                            ? { background: "var(--green-50, #f0fff4)", color: "var(--green-700, #276749)" }
                            : { background: "var(--red-50, #fff5f5)", color: "var(--red-700, #c53030)" }}
                        >
                          {canRegister ? "✓ Unlocked" : `Requires Step ${requiredStep}`}
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
