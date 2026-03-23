import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCommandCenterData } from "@/lib/chapter-dashboard-actions";
import Link from "next/link";
import { ActionCenter } from "@/components/chapter-dashboard/action-center";
import { MemberPulse } from "@/components/chapter-dashboard/member-pulse";
import { GrowthChart } from "@/components/chapter-dashboard/growth-chart";
import { ChapterGoals } from "@/components/chapter-dashboard/chapter-goals";

export default async function ChapterDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const data = await getCommandCenterData();

  return (
    <main className="main-content">
      {/* Chapter Header with Branding */}
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 24,
          position: "relative",
        }}
      >
        {data.chapter?.bannerUrl ? (
          <div style={{ height: 140, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.chapter.bannerUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              height: 140,
              background:
                "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {data.chapter?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.chapter.logoUrl}
              alt=""
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                objectFit: "cover",
                border: "3px solid white",
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: 20,
                border: "3px solid white",
              }}
            >
              {data.chapter?.name?.charAt(0) ?? "C"}
            </div>
          )}
          <div style={{ color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>{data.chapter?.name}</h1>
            {data.chapter?.tagline && (
              <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                {data.chapter.tagline}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/chapter/settings"
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            padding: "4px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
            color: "white",
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Settings
        </Link>
      </div>

      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href="/my-chapter" style={{ color: "var(--ypp-purple)", textDecoration: "none" }}>
          ← Chapter Home
        </Link>
        <span style={{ color: "var(--muted)", margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--muted)" }}>Command Center</span>
      </div>

      {/* Top Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{data.stats.totalMembers}</span>
          <span className="stat-label">Total Members</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.totalCourses}</span>
          <span className="stat-label">Courses</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.upcomingEvents}</span>
          <span className="stat-label">Upcoming Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.openPositions}</span>
          <span className="stat-label">Open Positions</span>
          {data.stats.totalApplications > 0 && (
            <Link href="/chapter/recruiting" className="stat-link">
              {data.stats.totalApplications} applications →
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid: Two Columns */}
      <div className="grid two" style={{ marginTop: 24, alignItems: "start" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Action Center */}
          <ActionCenter
            actionItems={data.actionItems}
            pendingJoinRequests={data.pendingJoinRequests}
            pendingApplications={data.pendingApplications}
          />

          {/* Growth Chart */}
          <GrowthChart snapshots={data.kpiSnapshots} />

          {/* Quick Actions */}
          <div className="card">
            <h2 style={{ margin: 0 }}>Quick Actions</h2>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <Link
                href="/chapter/recruiting"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                🧑‍💼 Recruiting
              </Link>
              <Link
                href="/chapter/recruiting/positions/new"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                ➕ New Position
              </Link>
              <Link
                href="/chapter/calendar"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                🗓 Chapter Calendar
              </Link>
              <Link
                href="/chapter/updates"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                📢 Send Update
              </Link>
              <Link
                href="/chapter/marketing"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                📊 Marketing
              </Link>
              <Link
                href="/chapter/instructors"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                👩‍🏫 Instructors
              </Link>
              <Link
                href="/chapter/students"
                className="action-btn"
                style={{ textDecoration: "none" }}
              >
                🎓 Students
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Member Pulse */}
          <MemberPulse
            stats={data.stats}
            inactiveMembers={data.inactiveMembers}
          />

          {/* Chapter Goals */}
          <ChapterGoals goals={data.activeGoals} />

          {/* Upcoming Events */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Upcoming Events</h2>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                {data.chapter?.events.length ?? 0} scheduled
              </span>
            </div>
            {(!data.chapter?.events || data.chapter.events.length === 0) ? (
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12 }}>
                No upcoming events.
              </p>
            ) : (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.chapter.events.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 8,
                        background: "var(--bg)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                        {new Date(event.startDate).getDate()}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
                        {new Date(event.startDate).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{event.title}</p>
                      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                        {event.eventType}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Enrollments */}
          {data.recentEnrollments.length > 0 && (
            <div className="card">
              <h2 style={{ margin: 0 }}>Recent Enrollments</h2>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {data.recentEnrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}
                  >
                    <span>
                      <strong>{enrollment.user.name}</strong>
                      <span style={{ color: "var(--muted)" }}> → {enrollment.course.title}</span>
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                      {new Date(enrollment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
