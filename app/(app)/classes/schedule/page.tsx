import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyClassSchedule } from "@/lib/class-management-actions";
import Link from "next/link";

const difficultyLabels: Record<string, string> = {
  LEVEL_101: "101",
  LEVEL_201: "201",
  LEVEL_301: "301",
  LEVEL_401: "401",
};

const difficultyColors: Record<string, string> = {
  LEVEL_101: "#22c55e",
  LEVEL_201: "#3b82f6",
  LEVEL_301: "#f59e0b",
  LEVEL_401: "#ef4444",
};

const dayColors: Record<string, string> = {
  Monday: "#7c3aed",
  Tuesday: "#2563eb",
  Wednesday: "#059669",
  Thursday: "#d97706",
  Friday: "#dc2626",
  Saturday: "#7c3aed",
  Sunday: "#6366f1",
};

export default async function SemesterPlanningCalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const enrollments = await getMyClassSchedule(session.user.id);

  // Organize sessions by month for calendar view
  const allSessions: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    topic: string;
    milestone: string | null;
    sessionNumber: number;
    classTitle: string;
    instructorName: string;
    deliveryMode: string;
    zoomLink: string | null;
    interestArea: string;
    difficultyLevel: string;
    offeringId: string;
    isCancelled: boolean;
  }[] = [];

  for (const enrollment of enrollments) {
    for (const s of enrollment.offering.sessions) {
      allSessions.push({
        id: s.id,
        date: new Date(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        topic: s.topic,
        milestone: s.milestone,
        sessionNumber: s.sessionNumber,
        classTitle: enrollment.offering.title,
        instructorName: enrollment.offering.instructor.name,
        deliveryMode: enrollment.offering.deliveryMode,
        zoomLink: enrollment.offering.zoomLink,
        interestArea: enrollment.offering.template.interestArea,
        difficultyLevel: enrollment.offering.template.difficultyLevel,
        offeringId: enrollment.offering.id,
        isCancelled: s.isCancelled,
      });
    }
  }

  // Sort by date
  allSessions.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by month
  const sessionsByMonth: Record<string, typeof allSessions> = {};
  for (const s of allSessions) {
    const key = s.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!sessionsByMonth[key]) sessionsByMonth[key] = [];
    sessionsByMonth[key].push(s);
  }

  // Split into upcoming and past
  const now = new Date();
  const upcomingSessions = allSessions.filter((s) => s.date >= now && !s.isCancelled);
  const nextSession = upcomingSessions[0];

  // Weekly overview: group upcoming sessions by day of week
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 7);

  const thisWeekSessions = upcomingSessions.filter(
    (s) => s.date >= thisWeekStart && s.date < thisWeekEnd
  );

  // Compute class totals
  const totalClasses = enrollments.length;
  const totalUpcoming = upcomingSessions.length;
  const totalHoursPerWeek = enrollments.reduce((sum, e) => {
    const days = e.offering.meetingDays.length;
    const timeParts = e.offering.meetingTime.split("-");
    if (timeParts.length === 2) {
      const [startH] = timeParts[0].split(":").map(Number);
      const [endH] = timeParts[1].split(":").map(Number);
      return sum + (endH - startH) * days;
    }
    return sum + 2 * days;
  }, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Schedule</p>
          <h1 className="page-title">Semester Planner</h1>
        </div>
        <Link href="/classes/catalog" className="button primary">
          Browse Classes
        </Link>
      </div>

      {/* Schedule Overview */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{totalClasses}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Enrolled Classes</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{totalUpcoming}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Upcoming Sessions</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{totalHoursPerWeek}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Hours / Week</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {enrollments.filter((e) => e.status === "WAITLISTED").length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>On Waitlist</div>
        </div>
      </div>

      {/* Next Up */}
      {nextSession && (
        <div className="card" style={{ marginBottom: 24, borderLeft: `4px solid var(--ypp-purple)` }}>
          <div style={{ fontSize: 12, color: "var(--ypp-purple)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            Next Up
          </div>
          <h3 style={{ marginTop: 4 }}>{nextSession.classTitle}</h3>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            Session {nextSession.sessionNumber}: {nextSession.topic}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
            <span>
              {nextSession.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
            <span>{nextSession.startTime} - {nextSession.endTime}</span>
            <span>{nextSession.instructorName}</span>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Link href={`/classes/${nextSession.offeringId}`} className="button secondary" style={{ fontSize: 13 }}>
              View Class
            </Link>
            {nextSession.zoomLink && (
              <a href={nextSession.zoomLink} target="_blank" rel="noopener noreferrer" className="button primary" style={{ fontSize: 13 }}>
                Join Zoom
              </a>
            )}
          </div>
        </div>
      )}

      {/* This Week */}
      {thisWeekSessions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">This Week</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {thisWeekSessions.map((s) => (
              <Link
                key={s.id}
                href={`/classes/${s.offeringId}`}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--radius-sm)",
                  background: (dayColors[s.date.toLocaleDateString("en-US", { weekday: "long" })] || "var(--ypp-purple)") + "15",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                    {s.date.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                    {s.date.getDate()}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.classTitle}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {s.startTime} - {s.endTime} | {s.topic}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <span className="pill" style={{ fontSize: 11, background: (difficultyColors[s.difficultyLevel] || "#888") + "18", color: difficultyColors[s.difficultyLevel] }}>
                    {difficultyLabels[s.difficultyLevel]}
                  </span>
                  <span className="pill" style={{ fontSize: 11 }}>{s.deliveryMode.replace("_", " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* My Enrolled Classes */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">My Classes</div>
        {enrollments.length === 0 ? (
          <div className="card">
            <h3>No Classes Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
              Browse the class catalog to find classes that match your interests.
            </p>
            <Link href="/classes/catalog" className="button primary" style={{ marginTop: 16 }}>
              Browse Classes
            </Link>
          </div>
        ) : (
          <div className="grid two">
            {enrollments.map((enrollment) => {
              const offering = enrollment.offering;
              const remainingSessions = offering.sessions.filter(
                (s) => new Date(s.date) >= now && !s.isCancelled
              ).length;

              return (
                <Link
                  key={enrollment.id}
                  href={`/classes/${offering.id}`}
                  className="card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <h3 style={{ fontSize: 16 }}>{offering.title}</h3>
                    <span className={`pill ${enrollment.status === "ENROLLED" ? "primary" : ""}`} style={{ fontSize: 11 }}>
                      {enrollment.status === "WAITLISTED" ? "Waitlisted" : "Enrolled"}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>
                    {offering.instructor.name}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="pill" style={{ fontSize: 11 }}>{offering.template.interestArea}</span>
                    <span className="pill" style={{ fontSize: 11, background: (difficultyColors[offering.template.difficultyLevel] || "#888") + "18", color: difficultyColors[offering.template.difficultyLevel] }}>
                      {difficultyLabels[offering.template.difficultyLevel]}
                    </span>
                    <span className="pill" style={{ fontSize: 11 }}>{offering.meetingDays.join(", ")}</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    {offering.meetingTime} | {remainingSessions} session{remainingSessions !== 1 ? "s" : ""} remaining
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Schedule by Month */}
      {Object.keys(sessionsByMonth).length > 0 && (
        <div>
          <div className="section-title">Full Schedule</div>
          {Object.entries(sessionsByMonth).map(([month, sessions]) => (
            <div key={month} style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 8 }}>{month}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      background: s.isCancelled ? "var(--gray-50)" : "var(--surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-light)",
                      opacity: s.isCancelled ? 0.5 : 1,
                      fontSize: 14,
                    }}
                  >
                    <div style={{ width: 40, fontWeight: 600, color: "var(--text-secondary)", fontSize: 13 }}>
                      {s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ width: 80, fontSize: 12, color: "var(--text-secondary)" }}>
                      {s.startTime}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{s.classTitle}</span>
                      <span style={{ color: "var(--text-secondary)" }}> - {s.topic}</span>
                      {s.isCancelled && <span style={{ color: "#ef4444" }}> (Cancelled)</span>}
                    </div>
                    <span className="pill" style={{ fontSize: 10, background: (difficultyColors[s.difficultyLevel] || "#888") + "18", color: difficultyColors[s.difficultyLevel] }}>
                      {difficultyLabels[s.difficultyLevel]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
