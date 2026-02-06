import { prisma } from "@/lib/prisma";
import CalendarView from "@/components/calendar-view";

export default async function CalendarPage() {
  // Pre-fetch current month's events for SSR
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { startDate: { gte: startOfMonth, lte: endOfMonth } },
        { endDate: { gte: startOfMonth, lte: endOfMonth } },
        { AND: [{ startDate: { lte: startOfMonth } }, { endDate: { gte: endOfMonth } }] },
      ],
    },
    include: { chapter: { select: { name: true } } },
    orderBy: { startDate: "asc" },
    take: 100,
  });

  // Serialize dates for client component
  const serializedEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    eventType: e.eventType,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    location: e.location,
    meetingUrl: e.meetingUrl,
    chapter: e.chapter ? { name: e.chapter.name } : null,
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Calendar</p>
          <h1 className="page-title">Visual Calendar</h1>
          <p className="page-subtitle">
            View all events, class schedules, and deadlines in one place.
          </p>
        </div>
      </div>
      <CalendarView initialEvents={serializedEvents} />
    </div>
  );
}
