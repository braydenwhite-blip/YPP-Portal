import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyMeetings } from "@/lib/college-advisor-scheduling";
import Link from "next/link";

export const metadata = { title: "Meeting History — College Advisor" };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  REQUESTED: { label: "Requested", color: "#d97706", bg: "#fffbeb" },
  CONFIRMED: { label: "Confirmed", color: "#16a34a", bg: "#f0fdf4" },
  COMPLETED: { label: "Completed", color: "#16a34a", bg: "#f0fdf4" },
  CANCELLED: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2" },
  NO_SHOW: { label: "No Show", color: "#dc2626", bg: "#fef2f2" },
};

export default async function MeetingHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getMyMeetings();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">Meeting History</h1>
          <p className="page-subtitle">
            {data ? `${data.meetings.length} meetings with ${data.advisorName}` : "No active advisorship"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/college-advisor/schedule" className="button primary small">
            Schedule Meeting
          </Link>
          <Link href="/college-advisor" className="button ghost small">
            ← Back
          </Link>
        </div>
      </div>

      {!data || data.meetings.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
          <p style={{ fontWeight: 600 }}>No meetings yet</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            Schedule your first meeting with your college advisor.
          </p>
          <Link href="/college-advisor/schedule" className="button primary">
            Schedule Meeting
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {data.meetings.map((m) => {
            const statusCfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.REQUESTED;
            return (
              <div key={m.id} className="card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: m.notes || m.actionItems ? "0.75rem" : 0 }}>
                  <div>
                    <p style={{ fontWeight: 700, margin: 0 }}>
                      {new Date(m.scheduledAt).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.15rem 0 0" }}>
                      {new Date(m.scheduledAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" · "}{m.durationMinutes} min
                      {m.topic && <> · {m.topic}</>}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {m.adviseeRating && (
                      <span style={{ fontSize: "0.82rem", color: "#d97706" }}>
                        {"★".repeat(m.adviseeRating)}{"☆".repeat(5 - m.adviseeRating)}
                      </span>
                    )}
                    <span
                      className="pill"
                      style={{ background: statusCfg.bg, color: statusCfg.color, fontSize: "0.72rem" }}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                {m.notes && (
                  <div style={{ padding: "0.5rem 0.75rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
                      Advisor Notes
                    </p>
                    <p style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{m.notes}</p>
                  </div>
                )}

                {m.actionItems && (
                  <div style={{ padding: "0.5rem 0.75rem", background: "#fefce8", borderRadius: "var(--radius-sm)", border: "1px solid #fde68a" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.78rem", color: "#92400e", marginBottom: "0.2rem" }}>
                      Action Items
                    </p>
                    <p style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{m.actionItems}</p>
                  </div>
                )}

                {m.meetingLink && m.status === "CONFIRMED" && (
                  <a
                    href={m.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button primary small"
                    style={{ marginTop: "0.75rem" }}
                  >
                    Join Meeting
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
