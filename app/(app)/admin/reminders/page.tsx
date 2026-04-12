import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  processNotificationDeliveryQueueAction,
  retryNotificationDeliveryAction,
} from "@/lib/notification-actions";
import { prisma } from "@/lib/prisma";

export default async function AutomatedRemindersPage() {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
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

  const [queuedCount, failedSmsCount, fallbackCount, quietHoursDeferredCount, recentFailures] =
    await Promise.all([
      prisma.notificationDelivery.count({
        where: { status: "QUEUED" },
      }),
      prisma.notificationDelivery.count({
        where: { channel: "SMS", status: "FAILED" },
      }),
      prisma.notificationDelivery.count({
        where: { isFallback: true },
      }),
      prisma.notificationDelivery.count({
        where: {
          status: "QUEUED",
          scheduledFor: { not: null },
        },
      }),
      prisma.notificationDelivery.findMany({
        where: {
          status: "FAILED",
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Automated Reminders</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Notification Operations</h3>
        <p>Watch the delivery queue, failed SMS attempts, quiet-hours deferrals, and manual reminder tools from one place.</p>
        <form action={processNotificationDeliveryQueueAction} style={{ marginTop: 16 }}>
          <button type="submit" className="button primary">
            Process Delivery Queue Now
          </button>
        </form>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        {[
          { label: "Queued Deliveries", value: queuedCount },
          { label: "Failed SMS", value: failedSmsCount },
          { label: "Fallback Emails", value: fallbackCount },
          { label: "Quiet-Hours Deferred", value: quietHoursDeferredCount },
        ].map((metric) => (
          <div key={metric.label} className="card">
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{metric.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{metric.value}</div>
          </div>
        ))}
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

      <div className="card" style={{ marginBottom: 28 }}>
        <div className="section-title">Recent Failed Deliveries</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recentFailures.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No failed deliveries right now.</p>
          ) : (
            recentFailures.map((delivery) => (
              <div
                key={delivery.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600 }}>
                    {delivery.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {delivery.channel} • {delivery.scenarioKey}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {delivery.user.name || delivery.user.email || "Unknown recipient"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {delivery.errorMessage || "No provider error was saved."}
                </div>
                <form action={retryNotificationDeliveryAction}>
                  <input type="hidden" name="deliveryId" value={delivery.id} />
                  <button type="submit" className="button secondary">
                    Retry Delivery
                  </button>
                </form>
              </div>
            ))
          )}
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
