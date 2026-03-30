import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getMyCollegeAdvisor,
  getAvailableAdvisors,
  requestAdvisor,
  canAccessCollegeAdvisor,
  getUserAwardTier,
} from "@/lib/alumni-actions";
import { getMyMeetings } from "@/lib/college-advisor-scheduling";
import Link from "next/link";

export const metadata = { title: "College Advisor" };

const TIER_MEETING_INFO: Record<string, string> = {
  SILVER: "1 meeting included",
  GOLD: "2 meetings included",
  LIFETIME: "Unlimited meetings",
};

export default async function CollegeAdvisorPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hasAccess = await canAccessCollegeAdvisor();
  const tier = await getUserAwardTier();

  if (!hasAccess) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">College Advisor</p>
            <h1 className="page-title">College Advisor</h1>
            <p className="page-subtitle">
              Connect with alumni for college guidance
            </p>
          </div>
        </div>
        <div
          className="card"
          style={{ textAlign: "center", padding: "3rem", maxWidth: "500px", margin: "2rem auto" }}
        >
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎓</div>
          <h2 style={{ margin: "0 0 1rem" }}>Silver Award Required</h2>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
            College Advisor matching is available to members who have earned at
            least a <strong>Silver Award</strong>.
            {tier === "BRONZE" && (
              <> You currently have a <strong>Bronze</strong> tier. Keep up the great work!</>
            )}
          </p>
          <Link href="/alumni" className="button primary">
            View Alumni Benefits
          </Link>
        </div>
      </div>
    );
  }

  const myAdvisor = await getMyCollegeAdvisor();
  const meetingData = myAdvisor ? await getMyMeetings() : null;
  const availableAdvisors = !myAdvisor ? await getAvailableAdvisors() : [];

  if (myAdvisor) {
    const advisor = myAdvisor.advisor;
    const user = advisor.user;
    const upcomingMeetings = meetingData?.meetings.filter(
      (m) => m.status === "REQUESTED" || m.status === "CONFIRMED"
    ) ?? [];
    const pastMeetings = meetingData?.meetings.filter(
      (m) => m.status === "COMPLETED" || m.status === "CANCELLED"
    ) ?? [];

    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">College Advisor</p>
            <h1 className="page-title">My College Advisor</h1>
            <p className="page-subtitle">
              {tier && TIER_MEETING_INFO[tier] ? TIER_MEETING_INFO[tier] : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/college-advisor/schedule" className="button primary small">
              Schedule Meeting
            </Link>
            <Link href="/college-advisor/resources" className="button outline small">
              Resources
            </Link>
          </div>
        </div>

        <div className="grid two" style={{ marginBottom: "1.5rem" }}>
          {/* Advisor Profile Card */}
          <div className="card" style={{ gridRow: "span 2" }}>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                alignItems: "center",
                marginBottom: "1.25rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "var(--ypp-purple-600)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 700, margin: 0, fontSize: "1.1rem" }}>{user.name}</p>
                <p style={{ color: "var(--muted)", margin: "0.15rem 0 0", fontSize: "0.82rem" }}>
                  Your College Advisor
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>🎓</span>
                <span>
                  <strong>{advisor.college}</strong>
                  {advisor.major && <span style={{ color: "var(--muted)" }}> — {advisor.major}</span>}
                </span>
              </div>
              {advisor.availability && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>📅</span>
                  <span>{advisor.availability}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>📧</span>
                <a href={`mailto:${user.email}`} style={{ color: "var(--ypp-purple-600)" }}>
                  {user.email}
                </a>
              </div>
              {user.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>📱</span>
                  <a href={`tel:${user.phone}`} style={{ color: "var(--ypp-purple-600)" }}>
                    {user.phone}
                  </a>
                </div>
              )}
            </div>

            {advisor.bio && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "1.25rem",
                }}
              >
                <p style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.3rem" }}>
                  About
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.6 }}>{advisor.bio}</p>
              </div>
            )}

            <a href={`mailto:${user.email}`} className="button primary" style={{ width: "100%", textAlign: "center", textDecoration: "none" }}>
              Send Email
            </a>
          </div>

          {/* Advisorship Details */}
          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Advisorship Details</p>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--muted)" }}>Started</span>
              <span style={{ fontWeight: 600 }}>
                {new Date(myAdvisor.startDate).toLocaleDateString()}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--muted)" }}>Total Meetings</span>
              <span style={{ fontWeight: 600 }}>{meetingData?.meetings.length ?? 0}</span>
            </div>
            {myAdvisor.notes && (
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "0.3rem" }}>Notes</p>
                <p style={{ margin: 0, padding: "0.5rem 0.75rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", fontSize: "0.88rem" }}>
                  {myAdvisor.notes}
                </p>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="card">
            <p style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Quick Links</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link href="/college-advisor/schedule" style={{ color: "var(--ypp-purple-600)", fontSize: "0.88rem", textDecoration: "none" }}>
                📅 Schedule a Meeting
              </Link>
              <Link href="/college-advisor/meetings" style={{ color: "var(--ypp-purple-600)", fontSize: "0.88rem", textDecoration: "none" }}>
                📋 Meeting History ({meetingData?.meetings.length ?? 0})
              </Link>
              <Link href="/college-advisor/resources" style={{ color: "var(--ypp-purple-600)", fontSize: "0.88rem", textDecoration: "none" }}>
                📚 Resource Library
              </Link>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        {upcomingMeetings.length > 0 && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontWeight: 700, marginBottom: "0.75rem" }}>
              Upcoming Meetings ({upcomingMeetings.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {upcomingMeetings.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: m.status === "CONFIRMED" ? "4px solid #16a34a" : "4px solid #d97706",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>
                      {new Date(m.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" at "}
                      {new Date(m.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                    {m.topic && <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.15rem 0 0" }}>{m.topic}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      className="pill"
                      style={{
                        background: m.status === "CONFIRMED" ? "#f0fdf4" : "#fffbeb",
                        color: m.status === "CONFIRMED" ? "#16a34a" : "#d97706",
                        fontSize: "0.75rem",
                      }}
                    >
                      {m.status === "CONFIRMED" ? "Confirmed" : "Requested"}
                    </span>
                    {m.meetingLink && (
                      <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="button primary small">
                        Join
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Past Meetings */}
        {pastMeetings.length > 0 && (
          <div>
            <p className="section-title" style={{ marginBottom: "0.75rem" }}>
              Recent Meetings
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {pastMeetings.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: "0.75rem 1rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: m.notes ? "0.5rem" : 0 }}>
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.88rem" }}>
                        {new Date(m.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {m.topic && <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>{m.topic}</p>}
                    </div>
                    <span
                      className="pill"
                      style={{
                        background: m.status === "COMPLETED" ? "#f0fdf4" : "#fef2f2",
                        color: m.status === "COMPLETED" ? "#16a34a" : "#dc2626",
                        fontSize: "0.72rem",
                      }}
                    >
                      {m.status === "COMPLETED" ? "Completed" : "Cancelled"}
                    </span>
                  </div>
                  {m.notes && (
                    <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>{m.notes}</p>
                  )}
                </div>
              ))}
              {pastMeetings.length > 3 && (
                <Link href="/college-advisor/meetings" className="button outline small" style={{ alignSelf: "flex-start" }}>
                  View All Meetings
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // No advisor — show available advisors
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">College Advisor</h1>
          <p className="page-subtitle">
            Connect with a YPP alumni who can guide your college journey
          </p>
        </div>
      </div>

      {availableAdvisors.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", maxWidth: "500px", margin: "2rem auto" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎓</div>
          <h2 style={{ margin: "0 0 1rem" }}>No Advisors Available</h2>
          <p style={{ color: "var(--muted)" }}>
            There are no college advisors available at this time. Please check back later.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {availableAdvisors.map((advisor) => (
            <div key={advisor.id} className="card">
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--ypp-purple-600)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {advisor.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 700, margin: 0 }}>{advisor.user.name}</p>
                  <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>{advisor.college}</p>
                </div>
              </div>

              {advisor.major && (
                <p style={{ fontSize: "0.85rem", margin: "0 0 0.3rem" }}>📚 {advisor.major}</p>
              )}
              {advisor.availability && (
                <p style={{ fontSize: "0.85rem", margin: "0 0 0.3rem" }}>📅 {advisor.availability}</p>
              )}
              <p style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>👥 {advisor._count.advisees} current advisees</p>

              {advisor.bio && (
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", padding: "0.5rem 0.75rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", marginBottom: "0.75rem" }}>
                  {advisor.bio}
                </p>
              )}

              <form action={requestAdvisor.bind(null, advisor.id)}>
                <button type="submit" className="button primary" style={{ width: "100%" }}>
                  Request This Advisor
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
