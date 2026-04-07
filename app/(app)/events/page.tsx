import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";

export default async function EventsPage() {
  const session = await getSession();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { roles: { select: { role: true } } },
      })
    : null;
  const isAdmin = user?.roles.some((role) => role.role === "ADMIN") ?? false;
  const chapterId = user?.chapterId ?? null;

  const events = await prisma.event.findMany({
    where: {
      isCancelled: false,
      ...(isAdmin
        ? {}
        : {
            OR: [
              { visibility: "PUBLIC" },
              ...(chapterId ? [{ chapterId, visibility: "INTERNAL" as const }] : []),
            ],
          }),
    },
    orderBy: { startDate: "asc" },
  });
  const prepCourses = await prisma.course.findMany({
    where: { format: "COMPETITION_PREP" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Events & Prep</p>
          <h1 className="page-title">Festivals, Showcases, & Competitions</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/calendar" className="button small">
            Visual Calendar
          </Link>
          <a href="/api/calendar" className="button small outline" download>
            Export iCal
          </a>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Events Calendar</h3>
          <p>
            Festivals and showcases are built into Labs to celebrate student work and build community.
          </p>
          <div style={{ marginTop: 16 }}>
            {events.length === 0 ? (
              <p>No events scheduled yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.title}</td>
                      <td>{event.eventType}</td>
                      <td>{new Date(event.startDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="card">
          <h3>Competition Preparation</h3>
          <p>
            Time-bound opportunities for students who want external benchmarks. Often feed into Labs or
            the Commons.
          </p>
          <div style={{ marginTop: 16 }}>
            {prepCourses.length === 0 ? (
              <p>No competition prep courses yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Interest Area</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {prepCourses.map((course) => (
                    <tr key={course.id}>
                      <td>{course.title}</td>
                      <td>{course.interestArea}</td>
                      <td>{course.isVirtual ? "Virtual" : "In-person first"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
