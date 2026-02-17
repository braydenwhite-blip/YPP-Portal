import { getServerSession } from "next-auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/data";
import { isUnifiedAllToolsDashboardEnabled } from "@/lib/dashboard/flags";
import { getStudentProgressSnapshot } from "@/lib/student-progress-actions";
import { prisma } from "@/lib/prisma";
import RoleHero from "@/components/dashboard/role-hero";
import KpiStrip from "@/components/dashboard/kpi-strip";
import QueueBoard from "@/components/dashboard/queue-board";
import NextActions from "@/components/dashboard/next-actions";
import ToolExplorer from "@/components/dashboard/tool-explorer";
import LegacyOverviewPage from "./legacy-overview-page";

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

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
  const activeRoles = (session.user.roles ?? []).length
    ? (session.user.roles ?? [])
    : (session.user.primaryRole ? [session.user.primaryRole] : []);

  let launchBanner: {
    title: string;
    content: string;
    createdAt: Date;
    linkUrl: string | null;
  } | null = null;

  try {
    const campaign = await prisma.rolloutCampaign.findFirst({
      where: {
        status: "SENT",
        ...(activeRoles.length > 0
          ? { targetRoles: { hasSome: activeRoles as any } }
          : {}),
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      select: {
        title: true,
        content: true,
        sentAt: true,
        createdAt: true,
        linkUrl: true,
      },
    });
    if (campaign) {
      launchBanner = {
        title: campaign.title,
        content: campaign.content,
        createdAt: campaign.sentAt ?? campaign.createdAt,
        linkUrl: campaign.linkUrl ?? null,
      };
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  if (!launchBanner) {
    const announcement = await prisma.announcement.findFirst({
      where: {
        isActive: true,
        title: { startsWith: "[Rollout]" },
        ...(activeRoles.length > 0
          ? { targetRoles: { hasSome: activeRoles as any } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        content: true,
        createdAt: true,
      },
    });
    if (announcement) {
      launchBanner = {
        title: announcement.title,
        content: announcement.content,
        createdAt: announcement.createdAt,
        linkUrl: null,
      };
    }
  }
  const studentSnapshot = dashboard.role === "STUDENT"
    ? await getStudentProgressSnapshot(session.user.id)
    : null;

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
  const priorityTool = dashboard.sections[0]?.modules[0];
  const queueTotal = dashboard.queues.reduce((sum, queue) => sum + queue.count, 0);
  const roleFocusItems = roleFocus[dashboard.role] ?? roleFocus.STAFF;
  const todayDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const portalPillars = [
    {
      title: "Learn",
      detail: "Find classes, pathways, and training in one place.",
      href: "/curriculum",
    },
    {
      title: "Build",
      detail: "Turn ideas into real output through challenges and projects.",
      href: "/activities",
    },
    {
      title: "Show Progress",
      detail: "See your momentum through KPIs, streaks, and role queues.",
      href: "/world",
    },
  ];

  const howToUsePortal = [
    "Open your top Next Action first.",
    "Complete one task and log your update.",
    "Check your progress cards and repeat tomorrow.",
  ];

  const quickExperienceLinks = [
    {
      title: "Activity Hub",
      description: "Pick your next activity across challenge, incubator, and project paths.",
      href: "/activities",
      tag: "HUB",
    },
    {
      title: "Challenges",
      description: "Build streaks and consistency with daily, weekly, and seasonal prompts.",
      href: "/challenges",
      tag: "CHL",
    },
    {
      title: "Incubator",
      description: "Move from idea to showcase with phase-based project support.",
      href: "/incubator",
      tag: "INC",
    },
    {
      title: "Passion World",
      description: "See your growth islands update from real activity and progress.",
      href: "/world",
      tag: "PWR",
    },
  ];

  const portalLoop = [
    {
      title: "1. Pick One Action",
      detail: "Start with your top Next Action so you do the highest-impact task first.",
    },
    {
      title: "2. Do The Work",
      detail: "Finish one challenge, activity, message, or update in the linked tool.",
    },
    {
      title: "3. Watch Everything Sync",
      detail: "Your queues, KPIs, and Passion World signals update automatically.",
    },
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Welcome back{session.user.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="page-subtitle">
            Your classes, activities, challenges, and progress in one place.
          </p>
        </div>
        <div className="badge" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
          {dashboard.roleLabel}
        </div>
      </div>

      <div className="overview-hero card">
        <div className="overview-hero-orb overview-hero-orb-left" aria-hidden />
        <div className="overview-hero-orb overview-hero-orb-right" aria-hidden />
        <div className="overview-hero-content">
          <span className="overview-hero-kicker">Your Portal Guide</span>
          <h2 className="overview-hero-title">
            Everything important is connected here, so you always know what to do next.
          </h2>
          <p className="overview-hero-copy">
            This page brings classes, challenges, incubator, communication, and progress into one simple command center.
            Start with one action, finish it, and your progress updates across the portal.
          </p>
          <p className="overview-hero-note">
            Today is {todayDateLabel}. If you only do one thing, finish your top Next Action.
          </p>

          <div className="overview-hero-stats">
            <div className="overview-hero-stat">
              <span className="overview-hero-stat-label">Next Actions</span>
              <strong>{dashboard.nextActions.length}</strong>
            </div>
            <div className="overview-hero-stat">
              <span className="overview-hero-stat-label">Live Queues</span>
              <strong>{queueTotal}</strong>
            </div>
            <div className="overview-hero-stat">
              <span className="overview-hero-stat-label">Focus</span>
              <strong>{roleFocusItems[0]}</strong>
            </div>
          </div>

          <div className="overview-pillar-grid">
            {portalPillars.map((pillar) => (
              <Link key={pillar.title} href={pillar.href} className="overview-pillar-card">
                <span className="overview-pillar-title">{pillar.title}</span>
                <span className="overview-pillar-detail">{pillar.detail}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card overview-flow-card">
        <div className="overview-flow-header">
          <h3 style={{ margin: 0 }}>How Everything Connects</h3>
          <p style={{ margin: 0 }}>
            One completed action updates your dashboard cards, role queues, and Passion World signals.
          </p>
        </div>
        <div className="overview-flow-grid">
          {portalLoop.map((item) => (
            <div key={item.title} className="overview-flow-item">
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>How To Use This Portal (3 Easy Steps)</h3>
          <div className="overview-steps">
            {howToUsePortal.map((step, index) => (
              <div key={step} className="overview-step-item">
                <span className="overview-step-number">{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Explore Key Areas</h3>
          <div className="overview-link-list">
            {quickExperienceLinks.map((item) => (
              <Link key={item.title} href={item.href} className="overview-link-card">
                <div>
                  <p className="overview-link-title">
                    <span className="overview-link-tag">{item.tag}</span> {item.title}
                  </p>
                  <p className="overview-link-description">{item.description}</p>
                </div>
                <span className="overview-link-arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <RoleHero
        role={dashboard.role}
        title={dashboard.heroTitle}
        subtitle={dashboard.heroSubtitle}
      />

      {launchBanner ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--ypp-purple)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{launchBanner.title}</h3>
            <span className="pill">{new Date(launchBanner.createdAt).toLocaleDateString()}</span>
          </div>
          <p style={{ marginTop: 8, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
            {launchBanner.content}
          </p>
          {launchBanner.linkUrl ? (
            <div style={{ marginTop: 10 }}>
              <Link href={launchBanner.linkUrl} className="link">
                Open rollout resource
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {priorityTool ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Start Here</h3>
          <p style={{ margin: 0 }}>
            One fast jump into your highest-priority tool for this role.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link href={priorityTool.href} className="link">
              Open {priorityTool.label}
            </Link>
          </div>
        </div>
      ) : null}

      <NextActions actions={dashboard.nextActions} />
      <QueueBoard queues={dashboard.queues} />
      <KpiStrip kpis={dashboard.kpis} />

      {dashboard.role === "STUDENT" && studentSnapshot ? (
        <div className="grid two" style={{ marginTop: 16 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>First Week Checklist</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
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
                  href: "/my-courses",
                },
                {
                  done: studentSnapshot.checklist.checkedInAtLeastOnce,
                  text: "Complete one check-in",
                  href: "/check-in",
                },
              ].map((item) => (
                <Link key={item.text} href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
                    <span>{item.text}</span>
                    <span className="pill" style={item.done ? { background: "#f0fdf4", color: "#166534" } : {}}>
                      {item.done ? "Done" : "Pending"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Due Soon (Next 7 Days)</h3>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Assignments due</span>
                <strong>{studentSnapshot.dueAssignmentsNext7Days}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Upcoming sessions</span>
                <strong>{studentSnapshot.upcomingSessionsNext7Days}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Training modules due</span>
                <strong>{studentSnapshot.trainingDue}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Pathway next steps</span>
                <strong>{studentSnapshot.nextPathwaySteps}</strong>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/curriculum" className="button secondary" style={{ fontSize: 13 }}>
                Open Curriculum
              </Link>
              <Link href="/pathways/progress" className="button secondary" style={{ fontSize: 13 }}>
                Open Pathway Progress
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <ToolExplorer
        sections={dashboard.sections}
        moduleBadgeByHref={dashboard.moduleBadgeByHref}
      />

      <div className="card" style={{ marginTop: 16 }}>
        <details className="dashboard-about">
          <summary>About this dashboard</summary>
          <div className="dashboard-about-content">
            <p style={{ marginTop: 0, color: "var(--muted)" }}>
              Dashboard generated at {new Date(dashboard.generatedAt).toLocaleTimeString()}.
            </p>
            <p style={{ marginBottom: 8 }}>
              Use queue cards for urgent work first, then use the All Tools Explorer for everything else.
            </p>
            <p style={{ marginBottom: 0 }}>
              Need full navigation? Open the sidebar and browse grouped tools in More.
            </p>

            <div className="portal-goal-grid">
              <div className="portal-goal-block">
                <h4>Portal Goals</h4>
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
                {roleFocusItems.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
