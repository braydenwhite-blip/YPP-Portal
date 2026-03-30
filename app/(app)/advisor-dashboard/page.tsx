import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getAdvisorDashboardData } from "@/lib/college-advisor-scheduling";
import Link from "next/link";

export const metadata = { title: "Advisor Dashboard" };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  REQUESTED: { label: "Pending", color: "#d97706", bg: "#fffbeb" },
  CONFIRMED: { label: "Confirmed", color: "#16a34a", bg: "#f0fdf4" },
  COMPLETED: { label: "Completed", color: "#16a34a", bg: "#f0fdf4" },
  CANCELLED: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2" },
  NO_SHOW: { label: "No Show", color: "#dc2626", bg: "#fef2f2" },
};

export default async function AdvisorDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let data;
  try {
    data = await getAdvisorDashboardData();
  } catch {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">Advisor Dashboard</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontWeight: 600 }}>You are not registered as a college advisor.</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Contact an admin to set up your advisor profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">Advisor Dashboard</h1>
          <p className="page-subtitle">
            {data.college}{data.major ? ` — ${data.major}` : ""}
          </p>
        </div>
        <Link href="/college-advisor/advisor-settings" className="button outline small">
          Manage Availability
        </Link>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "var(--ypp-purple-700)" }}>{data.advisees.length}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Active Advisees</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "var(--ypp-purple-700)" }}>{data.upcomingMeetings.length}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Upcoming Meetings</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "var(--ypp-purple-700)" }}>{data.completedMeetings}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Completed Meetings</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "#d97706" }}>
            {data.avgRating ? `${data.avgRating.toFixed(1)}/5` : "—"}
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Avg Rating</p>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        {/* Upcoming Meetings */}
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>
            Upcoming Meetings ({data.upcomingMeetings.length})
          </p>
          {data.upcomingMeetings.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No upcoming meetings.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.upcomingMeetings.map((m) => {
                const statusCfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.REQUESTED;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: "0.75rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: `4px solid ${statusCfg.color}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontWeight: 600, margin: 0, fontSize: "0.88rem" }}>
                          {m.adviseeName}
                        </p>
                        <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.1rem 0 0" }}>
                          {new Date(m.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {" at "}
                          {new Date(m.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {m.topic && <> · {m.topic}</>}
                        </p>
                      </div>
                      <span className="pill" style={{ background: statusCfg.bg, color: statusCfg.color, fontSize: "0.72rem" }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Advisees */}
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>
            My Advisees ({data.advisees.length})
          </p>
          {data.advisees.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No advisees assigned yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.advisees.map((a) => (
                <div
                  key={a.advisorshipId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: "0.88rem" }}>{a.adviseeName}</p>
                    <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: 0 }}>
                      Since {new Date(a.startDate).toLocaleDateString()} · {a.meetingCount} meetings
                    </p>
                  </div>
                  <a href={`mailto:${a.adviseeEmail}`} className="button ghost small" style={{ fontSize: "0.78rem" }}>
                    Email
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        {/* Availability */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, margin: 0 }}>My Availability</p>
            <Link href="/college-advisor/advisor-settings" className="button ghost small" style={{ fontSize: "0.78rem" }}>
              Edit
            </Link>
          </div>
          {data.availabilitySlots.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              No availability set. <Link href="/college-advisor/advisor-settings" style={{ color: "var(--ypp-purple-600)" }}>Set up your schedule</Link>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {data.availabilitySlots.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.4rem 0.6rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{DAY_NAMES[s.dayOfWeek]}</span>
                  <span style={{ color: "var(--muted)" }}>{s.startTime} — {s.endTime}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resources */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, margin: 0 }}>My Resources ({data.resources.length})</p>
            <Link href="/college-advisor/resources" className="button ghost small" style={{ fontSize: "0.78rem" }}>
              View All
            </Link>
          </div>
          {data.resources.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              No resources shared yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {data.resources.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "0.4rem 0.6rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.85rem",
                  }}
                >
                  <p style={{ fontWeight: 600, margin: 0 }}>{r.title}</p>
                  <p style={{ color: "var(--muted)", fontSize: "0.72rem", margin: 0 }}>
                    {r.category.replace(/_/g, " ")} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Past Meetings */}
      {data.pastMeetings.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Recent Past Meetings
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {data.pastMeetings.slice(0, 5).map((m) => {
              const statusCfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.COMPLETED;
              return (
                <div key={m.id} className="card" style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.88rem" }}>{m.adviseeName}</p>
                      <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.1rem 0 0" }}>
                        {new Date(m.scheduledAt).toLocaleDateString()}
                        {m.topic && <> · {m.topic}</>}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {m.adviseeRating && (
                        <span style={{ fontSize: "0.78rem", color: "#d97706" }}>
                          {"★".repeat(m.adviseeRating)}
                        </span>
                      )}
                      <span className="pill" style={{ background: statusCfg.bg, color: statusCfg.color, fontSize: "0.72rem" }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
