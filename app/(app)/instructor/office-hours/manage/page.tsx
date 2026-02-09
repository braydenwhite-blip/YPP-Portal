import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ManageOfficeHoursPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get instructor's office hour slots
  const officeHours = await prisma.officeHourSlot.findMany({
    where: { instructorId: session.user.id },
    include: {
      bookings: {
        include: { student: true }
      }
    },
    orderBy: { startTime: "asc" }
  });

  const upcomingSlots = officeHours.filter(slot => new Date(slot.startTime) >= new Date());
  const pastSlots = officeHours.filter(slot => new Date(slot.startTime) < new Date());

  const totalBookings = officeHours.reduce((sum, slot) => sum + slot.bookings.length, 0);
  const totalSlots = officeHours.length;
  const utilizationRate = totalSlots > 0 ? Math.round((totalBookings / totalSlots) * 100) : 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Manage Office Hours</h1>
        </div>
        <a href="/instructor/office-hours/create-slot" className="button primary">
          Add Time Slot
        </a>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Office Hours Scheduler</h3>
        <p>
          Set up your available office hours and let students book time with you.
          Create recurring or one-time slots to make yourself accessible.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{upcomingSlots.length}</div>
          <div className="kpi-label">Upcoming Slots</div>
        </div>
        <div className="card">
          <div className="kpi">{totalBookings}</div>
          <div className="kpi-label">Total Bookings</div>
        </div>
        <div className="card">
          <div className="kpi">{utilizationRate}%</div>
          <div className="kpi-label">Utilization Rate</div>
        </div>
      </div>

      {/* Upcoming slots */}
      {upcomingSlots.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Upcoming Office Hours</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcomingSlots.map(slot => {
              const isBooked = slot.bookings.length > 0;

              return (
                <div key={slot.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>
                          {new Date(slot.startTime).toLocaleDateString()} • {" "}
                          {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{" "}
                          {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h3>
                        {isBooked ? (
                          <span className="pill success">Booked</span>
                        ) : (
                          <span className="pill">Available</span>
                        )}
                      </div>

                      {slot.location && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                          📍 {slot.location}
                        </div>
                      )}

                      {slot.notes && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                          📝 {slot.notes}
                        </div>
                      )}

                      {isBooked && (
                        <div style={{ marginTop: 12 }}>
                          <strong style={{ fontSize: 14 }}>Booked by:</strong>
                          {slot.bookings.map(booking => (
                            <div key={booking.id} style={{ fontSize: 14, marginTop: 4 }}>
                              • {booking.student.name}
                              {booking.topic && ` - ${booking.topic}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      {!isBooked && (
                        <form action="/api/office-hours/delete-slot" method="POST">
                          <input type="hidden" name="slotId" value={slot.id} />
                          <button type="submit" className="button secondary small">
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {upcomingSlots.length === 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            No upcoming office hours scheduled. Add time slots to let students book time with you!
          </p>
        </div>
      )}

      {/* Quick add form */}
      <div className="card">
        <h3>Quick Add Slot</h3>
        <form action="/api/office-hours/create-slot" method="POST" style={{ marginTop: 16 }}>
          <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="date" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label htmlFor="location" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                placeholder="e.g., Room 204 or Zoom link"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="startTime" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Start Time
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label htmlFor="endTime" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                End Time
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="notes" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              Notes (Optional)
            </label>
            <input
              type="text"
              id="notes"
              name="notes"
              placeholder="e.g., Bring your project questions"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <button type="submit" className="button primary">
            Add Slot
          </button>
        </form>
      </div>
    </div>
  );
}
