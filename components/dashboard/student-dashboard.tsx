import Link from "next/link";
import PathwayWidget from "@/components/dashboard/pathway-widget";
import type { DashboardData } from "@/lib/dashboard/types";
import type { StudentProgressSnapshot } from "@/lib/student-progress-actions";

interface StudentDashboardProps {
  firstName: string;
  todayDateLabel: string;
  unreadMessages: number;
  unreadNotifications: number;
  studentSnapshot: StudentProgressSnapshot | null;
  activePathways: DashboardData["activePathways"];
}

export default function StudentDashboard({
  firstName,
  todayDateLabel,
  unreadMessages,
  unreadNotifications,
  studentSnapshot,
  activePathways,
}: StudentDashboardProps) {
  const quickLinks = [
    {
      title: "My Classes",
      description: "Find classes, challenges, and learning pathways.",
      href: "/curriculum",
      icon: "🗺️",
    },
    {
      title: "Projects",
      description: "Turn ideas into real output through labs and the incubator.",
      href: "/incubator",
      icon: "🛠️",
    },
    {
      title: "Challenges",
      description: "Build streaks and consistency with daily prompts.",
      href: "/challenges",
      icon: "🏆",
    },
    {
      title: "My Chapter",
      description: "Connect with your community and find local events.",
      href: "/my-chapter",
      icon: "👥",
    },
  ];

  return (
    <div>
      <div className="topbar topbar-dashboard">
        <div>
          <h1 className="dashboard-page-title">
            Hi, <span className="dashboard-welcome-name">{firstName}</span>
          </h1>
          <p className="dashboard-header-date">
            <span className="dashboard-header-role">Student</span>
            <span className="dashboard-header-sep" aria-hidden>
              {" "}
              ·{" "}
            </span>
            {todayDateLabel}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <span className="dashboard-role-pill">Student</span>
          <Link
            href="/messages"
            className={`dashboard-header-icon-btn${unreadMessages > 0 ? " has-unread" : ""}`}
            aria-label={
              unreadMessages > 0
                ? `Messages, ${unreadMessages > 99 ? "99+" : unreadMessages} unread`
                : "Messages"
            }
          >
            ✉
          </Link>
          <Link
            href="/notifications"
            className={`dashboard-header-icon-btn${unreadNotifications > 0 ? " has-unread" : ""}`}
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications > 99 ? "99+" : unreadNotifications} unread`
                : "Notifications"
            }
          >
            🔔
          </Link>
        </div>
      </div>

      <div className="overview-hero card overview-hero--student-compact" style={{ padding: "32px 24px" }}>
        <div className="overview-hero-orb overview-hero-orb-left" aria-hidden />
        <div className="overview-hero-orb overview-hero-orb-right" aria-hidden />
        <div className="overview-hero-content">
          <span className="overview-hero-kicker" style={{ color: "var(--ypp-purple)" }}>Your Learning Journey</span>
          <h2 className="overview-hero-title" style={{ fontSize: "28px", marginTop: "8px" }}>
            Ready to build something new, <span className="dashboard-welcome-name">{firstName}?</span>
          </h2>
          <p className="overview-hero-copy overview-hero-copy--student" style={{ fontSize: "16px", maxWidth: "600px", marginTop: "12px" }}>
            Pick up where you left off or join a new pathway to start turning your ideas into real projects.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/curriculum" className="button" style={{ fontSize: "15px", padding: "10px 20px" }}>
              Explore Classes
            </Link>
            <Link href="/pathways/progress" className="button secondary" style={{ fontSize: "15px", padding: "10px 20px" }}>
              View My Progress
            </Link>
          </div>
        </div>
      </div>

      {studentSnapshot ? (
        <div className="card student-dashboard-snapshot" style={{ marginTop: 24 }}>
          <div className="student-dashboard-snapshot-grid">
            <div style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🎯</span> Up Next For You
              </h3>
              <div className="student-checklist-compact">
                {[
                  {
                    done: studentSnapshot.checklist.profileCompleted,
                    text: "Complete your profile",
                    href: "/onboarding",
                  },
                  {
                    done: studentSnapshot.checklist.joinedFirstClass,
                    text: "Join your first class",
                    href: "/curriculum",
                  },
                  {
                    done: studentSnapshot.checklist.submittedFirstAssignment,
                    text: "Submit your first assignment",
                    href: "/my-classes",
                  },
                  {
                    done: studentSnapshot.checklist.checkedInAtLeastOnce,
                    text: "Complete one check-in",
                    href: "/check-in",
                  },
                ].map((item) => (
                  <Link key={item.text} href={item.href} className="student-checklist-row" style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "15px", fontWeight: item.done ? 400 : 500 }}>{item.text}</span>
                    <span className={`student-checklist-status${item.done ? " is-done" : ""}`}>
                      {item.done ? "Done ✓" : "To do"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⏳</span> Due Soon
              </h3>
              <div className="card" style={{ background: "var(--surface)", border: "none" }}>
                <div className="student-due-compact" style={{ gap: "16px" }}>
                  <div className="student-due-row" style={{ fontSize: "15px" }}>
                    <span>Assignments due</span>
                    <strong style={{ fontSize: "18px", color: studentSnapshot.dueAssignmentsNext7Days > 0 ? "var(--urgent-text)" : "inherit" }}>
                      {studentSnapshot.dueAssignmentsNext7Days}
                    </strong>
                  </div>
                  <div className="student-due-row" style={{ fontSize: "15px" }}>
                    <span>Upcoming sessions</span>
                    <strong style={{ fontSize: "18px" }}>{studentSnapshot.upcomingSessionsNext7Days}</strong>
                  </div>
                  <div className="student-due-row" style={{ fontSize: "15px" }}>
                    <span>Pathway steps</span>
                    <strong style={{ fontSize: "18px" }}>{studentSnapshot.nextPathwaySteps}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <h3 style={{ fontSize: "20px" }}>Jump Back In</h3>
      </div>
      
      <div className="grid two" style={{ marginBottom: 24 }}>
        {quickLinks.map((item) => (
          <Link key={item.title} href={item.href} className="card" style={{ display: "flex", alignItems: "flex-start", gap: "16px", textDecoration: "none" }}>
            <div style={{ fontSize: "32px", background: "var(--surface)", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px" }}>
              {item.icon}
            </div>
            <div>
              <h4 style={{ margin: "0 0 4px", fontSize: "18px", color: "var(--foreground)" }}>
                {item.title}
              </h4>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px", lineHeight: 1.5 }}>
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {activePathways !== undefined && activePathways.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <PathwayWidget pathways={activePathways} />
        </div>
      )}
    </div>
  );
}
