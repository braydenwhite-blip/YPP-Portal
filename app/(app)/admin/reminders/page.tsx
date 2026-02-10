import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AutomatedRemindersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get upcoming assignments for reminder generation
  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      dueDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    },
    include: {
      course: true
    },
    orderBy: { dueDate: "asc" },
    take: 10
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Automated Reminders</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Reminder Automation System</h3>
        <p>Configure automatic reminders for assignments, events, and other important dates.</p>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>Assignment Reminders</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16 }}>
            Send reminders to students about upcoming assignment deadlines.
          </p>
          <form action="/api/admin/reminders/send-assignment" method="POST">
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Days Before Due Date
              </label>
              <select name="daysBefore" required style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                <option value="1">1 day before</option>
                <option value="2">2 days before</option>
                <option value="3">3 days before</option>
                <option value="7">1 week before</option>
              </select>
            </div>
            <button type="submit" className="button primary">
              Send Assignment Reminders
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Event Reminders</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16 }}>
            Remind users about upcoming events and sessions.
          </p>
          <form action="/api/admin/reminders/send-event" method="POST">
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Hours Before Event
              </label>
              <select name="hoursBefore" required style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                <option value="1">1 hour before</option>
                <option value="24">24 hours before</option>
                <option value="48">48 hours before</option>
              </select>
            </div>
            <button type="submit" className="button primary">
              Send Event Reminders
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Upcoming Assignments (Next 7 Days)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {upcomingAssignments.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No assignments due in the next 7 days.</p>
          ) : (
            upcomingAssignments.map(assignment => (
              <div key={assignment.id} style={{ padding: 12, backgroundColor: "var(--accent-bg)", borderRadius: 6 }}>
                <div style={{ fontWeight: 600 }}>{assignment.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {assignment.course.title} • Due{" "}
                  {assignment.dueDate ? assignment.dueDate.toLocaleDateString() : "TBD"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
