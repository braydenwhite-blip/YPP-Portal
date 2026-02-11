import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function OfficeHoursPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  // Get user's bookings (if student)
  const myBookings = !isInstructor ? await prisma.officeHoursBooking.findMany({
    where: { studentId: session.user.id },
    include: {
      officeHours: {
        include: { instructor: true }
      }
    },
    orderBy: { date: "asc" }
  }) : [];

  // Get available office hours from all instructors
  const availableOfficeHours = await prisma.officeHours.findMany({
    where: {
      isActive: true,
      ...(isInstructor ? {} : { instructorId: { not: session.user.id } })
    },
    include: {
      instructor: true,
      _count: {
        select: { bookings: true }
      }
    },
    orderBy: { dayOfWeek: "asc" }
  });

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Office Hours</h1>
        </div>
        {isInstructor && (
          <Link href="/office-hours/manage" className="button primary">
            Manage My Hours
          </Link>
        )}
      </div>

      {!isInstructor && myBookings.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Your Upcoming Bookings</div>
          <div className="grid two">
            {myBookings.filter(b => new Date(b.date) >= new Date() && b.status === "SCHEDULED").map(booking => (
              <div key={booking.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{booking.officeHours.instructor.name}</h3>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      {new Date(booking.date).toLocaleDateString()} at {booking.startTime}
                    </p>
                  </div>
                  <span className="pill primary">Scheduled</span>
                </div>
                {booking.topic && (
                  <p style={{ marginTop: 12 }}>
                    <strong>Topic:</strong> {booking.topic}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-title">Book Office Hours</div>
        {availableOfficeHours.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
              No office hours available at this time.
            </p>
          </div>
        ) : (
          <div className="grid two">
            {availableOfficeHours.map(hours => (
              <div key={hours.id} className="card">
                <h3>{hours.instructor.name}</h3>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--primary-color)" }}>
                    {dayNames[hours.dayOfWeek]}s
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {hours.startTime} - {hours.endTime}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {hours.slotDuration} minute slots
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span className="pill">{hours._count.bookings} bookings</span>
                </div>
                {!isInstructor && (
                  <Link
                    href={`/office-hours/book/${hours.id}`}
                    className="button primary"
                    style={{ marginTop: 12, width: "100%" }}
                  >
                    Book a Slot
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
