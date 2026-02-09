import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function VolunteerHoursPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const volunteerLogs = await prisma.volunteerLog.findMany({
    include: { user: true },
    orderBy: { date: 'desc' },
    take: 50
  });

  const totalHours = volunteerLogs.reduce((sum, log) => sum + log.hours, 0);
  const uniqueVolunteers = new Set(volunteerLogs.map(l => l.userId)).size;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Volunteer Hour Tracking</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Track Community Volunteer Hours</h3>
        <p>Monitor and recognize volunteer contributions across the organization.</p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{totalHours.toFixed(1)}</div>
          <div className="kpi-label">Total Hours Logged</div>
        </div>
        <div className="card">
          <div className="kpi">{uniqueVolunteers}</div>
          <div className="kpi-label">Active Volunteers</div>
        </div>
        <div className="card">
          <div className="kpi">{volunteerLogs.length}</div>
          <div className="kpi-label">Log Entries</div>
        </div>
      </div>

      <div>
        <div className="section-title">Recent Volunteer Activity</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {volunteerLogs.map(log => (
            <div key={log.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <h4>{log.user.name}</h4>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{log.activity}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    {new Date(log.date).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  {log.hours}h
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
