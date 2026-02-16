import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/data";
import { isUnifiedAllToolsDashboardEnabled } from "@/lib/dashboard/flags";
import RoleHero from "@/components/dashboard/role-hero";
import KpiStrip from "@/components/dashboard/kpi-strip";
import QueueBoard from "@/components/dashboard/queue-board";
import NextActions from "@/components/dashboard/next-actions";
import ToolExplorer from "@/components/dashboard/tool-explorer";
import LegacyOverviewPage from "./legacy-overview-page";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);

  if (!isUnifiedAllToolsDashboardEnabled()) {
    return <LegacyOverviewPage />;
  }

  if (!session?.user?.id) {
    return <LegacyOverviewPage />;
  }

  const dashboard = await getDashboardData(
    session.user.id,
    session.user.primaryRole ?? null
  );

  const roleFocus: Record<string, string[]> = {
    ADMIN: [
      "Clear high-risk operational queues daily.",
      "Keep hiring, readiness, and waitlist motion visible.",
    ],
    CHAPTER_LEAD: [
      "Run chapter hiring and interviews without side spreadsheets.",
      "Keep instructor readiness blockers near zero.",
    ],
    INSTRUCTOR: [
      "Protect class quality while clearing readiness blockers fast.",
      "Use one weekly next action to keep momentum.",
    ],
    STUDENT: [
      "Finish one pathway step every week.",
      "Translate exploration into classes and project progress.",
    ],
    MENTOR: [
      "Keep mentee check-ins current and actionable.",
      "Use one queue view to prevent silent drop-off.",
    ],
    PARENT: [
      "Track student updates and communication in one flow.",
      "Resolve pending links and alerts quickly.",
    ],
    STAFF: [
      "Use dashboard queues to keep operations moving.",
      "Prioritize highest-impact actions each day.",
    ],
  };

  const portalGoals = [
    "One clear next step for every user every week.",
    "One trusted source of truth for training, progress, and readiness.",
    "One connected flow from onboarding to outcomes with less admin overhead.",
  ];

  const passionWorldGoals = [
    "Turn curiosity into action with clear island-based paths.",
    "Make progress visible through challenges, badges, and milestones.",
    "Connect exploration to real classes, projects, and mentorship opportunities.",
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Welcome back{session.user.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="page-subtitle">
            Unified command center for your primary role.
          </p>
        </div>
        <div className="badge" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
          {dashboard.roleLabel}
        </div>
      </div>

      <RoleHero
        role={dashboard.role}
        title={dashboard.heroTitle}
        subtitle={dashboard.heroSubtitle}
      />

      <KpiStrip kpis={dashboard.kpis} />
      <QueueBoard queues={dashboard.queues} />
      <NextActions actions={dashboard.nextActions} />

      <ToolExplorer
        sections={dashboard.sections}
        moduleBadgeByHref={dashboard.moduleBadgeByHref}
      />

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Portal Compass</h3>
          <p style={{ marginTop: 0 }}>
            Clear goals to keep YPP focused while the dashboard scales.
          </p>
          <div className="portal-goal-grid">
            <div className="portal-goal-block">
              <h4>YPP Portal Goals</h4>
              <ul className="portal-goal-list">
                {portalGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
            <div className="portal-goal-block">
              <h4>Passion World Goals</h4>
              <ul className="portal-goal-list">
                {passionWorldGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="portal-role-focus">
            <span className="portal-role-focus-label">This role should focus on:</span>
            <ul className="portal-goal-list compact">
              {(roleFocus[dashboard.role] ?? roleFocus.STAFF).map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <h3>Operational Notes</h3>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Dashboard generated at {new Date(dashboard.generatedAt).toLocaleTimeString()}.
          </p>
          <p style={{ marginBottom: 8 }}>
            Use queue cards for urgent work, then use the All Tools Explorer for everything else.
          </p>
          <p style={{ marginBottom: 0 }}>
            Need full navigation? Open the sidebar or jump to your top section from here.
          </p>
          {dashboard.sections[0]?.modules[0] ? (
            <div style={{ marginTop: 12 }}>
              <Link href={dashboard.sections[0].modules[0].href} className="link">
                Open first priority tool
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
