import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ManageOfficeHoursPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor =
    session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";
  if (!isInstructor) {
    redirect("/");
  }

  const now = new Date();
  const slots = await prisma.officeHours.findMany({
    where: { instructorId: session.user.id, isActive: true },
    include: {
      bookings: {
        where: { date: { gte: now }, status: "SCHEDULED" },
        include: { student: { select: { name: true, email: true } } },
        orderBy: { date: "asc" },
        take: 20,
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const upcomingBookings = slots
    .flatMap((slot) =>
      slot.bookings.map((b) => ({ ...b, slotDuration: slot.slotDuration }))
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Manage Office Hours</h1>
          <p className="page-subtitle">
            Configure your weekly availability. Students book time through the Office Hours page.
          </p>
        </div>
      </div>

      {slots.length === 0 ? (
        <>
          <div className="card" style={{ marginBottom: 24, padding: "28px 32px" }}>
            <h3 style={{ marginBottom: 12 }}>No office hours configured yet</h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 16 }}>
              Set up your weekly availability so students can book focused time with you. Once
              configured, your slots will appear on the student-facing Office Hours page and students
              can reserve a session directly.
            </p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              To add a slot, use the scheduling API or ask your admin to enable the slot creation UI.
              Slots are defined by day of week, start time, end time, and session duration (default 30 min).
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {[
              {
                icon: "📅",
                title: "Weekly recurring",
                desc: "Office hour slots repeat each week automatically — set once and students can book any week.",
              },
              {
                icon: "🕐",
                title: "Flexible durations",
                desc: "Choose 15, 30, or 60-minute session lengths to match how you like to work with students.",
              },
              {
                icon: "📝",
                title: "Topical bookings",
                desc: "Students describe their topic when booking so you can prepare before the session.",
              },
            ].map((item) => (
              <div key={item.title} className="card">
                <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 style={{ marginBottom: 16 }}>Weekly Schedule</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="card"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <strong>{DAY_NAMES[slot.dayOfWeek]}</strong>
                  <span style={{ marginLeft: 16, color: "var(--text-secondary)" }}>
                    {slot.startTime} – {slot.endTime}
                  </span>
                  <span style={{ marginLeft: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                    ({slot.slotDuration} min sessions)
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    className="pill"
                    style={{ backgroundColor: "#10b981", color: "white", border: "none", fontSize: 12 }}
                  >
                    Active
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {slot.bookings.length} upcoming booking{slot.bookings.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ marginBottom: 16 }}>Upcoming Bookings</h2>
          {upcomingBookings.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "32px" }}>
              <p style={{ color: "var(--text-secondary)" }}>
                No bookings scheduled yet. Students can book through the Office Hours page.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{booking.student.name}</div>
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {new Date(booking.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}{" "}
                        · {booking.startTime} – {booking.endTime}
                      </div>
                      {booking.topic && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic" }}>
                          Topic: {booking.topic}
                        </div>
                      )}
                    </div>
                    <span className="pill">{booking.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
