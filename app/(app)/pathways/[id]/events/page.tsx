import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EventRegistrationButton } from "./event-registration-client";
import { getSingleStudentPathwayJourney } from "@/lib/chapter-pathway-journey";

function hasCompletedThroughStepOrder(
  steps: Array<{ stepOrder: number; status: "NOT_STARTED" | "WAITLISTED" | "ENROLLED" | "COMPLETED" }>,
  requiredStepOrder: number
) {
  return steps
    .filter((step) => step.stepOrder <= requiredStepOrder)
    .every((step) => step.status === "COMPLETED");
}

export default async function PathwayEventsPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [pathway, viewer] = await Promise.all([
    getSingleStudentPathwayJourney(userId, params.id),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        chapterId: true,
        chapter: { select: { name: true } },
      },
    }),
  ]);

  if (!pathway) notFound();
  if (!pathway.isVisibleInChapter && !pathway.isEnrolled && !pathway.isComplete) {
    notFound();
  }

  const events = await prisma.pathwayEvent.findMany({
    where: {
      pathwayId: params.id,
      OR: viewer?.chapterId
        ? [{ chapterId: null }, { chapterId: viewer.chapterId }]
        : [{ chapterId: null }],
    },
    include: {
      chapter: { select: { id: true, name: true } },
      pathwayStep: {
        select: {
          id: true,
          stepOrder: true,
          title: true,
          classTemplate: { select: { title: true } },
        },
      },
      registrations: { where: { userId }, select: { id: true } },
      _count: {
        select: { registrations: true },
      },
    },
    orderBy: { eventDate: "asc" },
  }).catch(() => [] as any[]);

  const now = new Date();

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← {pathway.name}
          </Link>
          <h1 className="page-title">Pathway Events</h1>
          <p className="page-subtitle">
            Milestone workshops and events for {pathway.name}. Registration opens once the required
            mapped class steps are complete.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>How unlocks work now</h3>
        <p style={{ marginBottom: 0, color: "var(--gray-600)" }}>
          Local chapter events are advisory and optional. If an event points to a pathway step, you need
          to finish that mapped step. If it uses a step order, you need every mapped step up through that
          order to be complete.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card">
          <h3>No events scheduled yet</h3>
          <p style={{ color: "var(--gray-500)" }}>
            Your chapter admin will schedule workshops and milestone events for this pathway.
            Check back soon.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {events.map((event: any) => {
            const isPast = event.eventDate && new Date(event.eventDate) < now;
            const isRegistered = event.registrations.length > 0;
            const requiredStepOrder = event.pathwayStep?.stepOrder ?? event.requiredStepOrder ?? 0;
            const requiredStepId = event.pathwayStep?.id ?? null;
            const canRegister =
              requiredStepId != null
                ? pathway.steps.some((step) => step.id === requiredStepId && step.status === "COMPLETED")
                : requiredStepOrder > 0
                  ? hasCompletedThroughStepOrder(pathway.steps, requiredStepOrder)
                  : true;
            const isFull =
              event.maxAttendees != null &&
              event._count.registrations >= event.maxAttendees;

            return (
              <div
                key={event.id}
                className="card"
                style={{
                  opacity: isPast ? 0.75 : 1,
                  borderLeft: `4px solid ${isPast ? "var(--gray-300)" : isRegistered ? "var(--green-500, #48bb78)" : "var(--ypp-purple)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{event.title}</h3>
                    {event.description && (
                      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--gray-600)" }}>
                        {event.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                      {event.eventDate && (
                        <span className="pill">
                          {new Date(event.eventDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {event.chapter?.name ? (
                        <span className="pill">{event.chapter.name}</span>
                      ) : (
                        <span className="pill">Network event</span>
                      )}
                      {event.locationOrLink && <span className="pill">{event.locationOrLink}</span>}
                      {event.maxAttendees && (
                        <span className="pill">
                          {event._count.registrations} / {event.maxAttendees} registered
                        </span>
                      )}
                      {requiredStepOrder > 0 && (
                        <span
                          className="pill"
                          style={
                            canRegister
                              ? { background: "var(--green-50, #f0fff4)", color: "var(--green-700, #276749)" }
                              : { background: "var(--red-50, #fff5f5)", color: "var(--red-700, #c53030)" }
                          }
                        >
                          {canRegister ? "Unlocked" : `Finish through Step ${requiredStepOrder}`}
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
                      requiredStep={requiredStepOrder}
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
