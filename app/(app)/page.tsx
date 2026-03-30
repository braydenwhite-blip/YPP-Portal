import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { Prisma } from "@prisma/client";
import { getDashboardData } from "@/lib/dashboard/data";
import { isUnifiedAllToolsDashboardEnabled } from "@/lib/dashboard/flags";
import { getStudentProgressSnapshot } from "@/lib/student-progress-actions";
import { prisma } from "@/lib/prisma";
import RoleHero from "@/components/dashboard/role-hero";
import KpiStrip from "@/components/dashboard/kpi-strip";
import QueueBoard from "@/components/dashboard/queue-board";
import NextActions from "@/components/dashboard/next-actions";
import PathwayWidget from "@/components/dashboard/pathway-widget";
import InstructorReadinessWidget from "@/components/dashboard/instructor-readiness-widget";
import DailyChecklist from "@/components/dashboard/daily-checklist";
import JourneyRoadmap from "@/components/dashboard/journey-roadmap";
import NudgeStrip from "@/components/dashboard/nudge-strip";
import AtRiskPanel from "@/components/dashboard/at-risk-panel";
import { getAtRiskChapters } from "@/lib/governance/actions";
import LegacyOverviewPage from "./legacy-overview-page";
import type { DashboardKpi } from "@/lib/dashboard/types";

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

type HeroStatTone = "urgent" | "warning" | "success" | "info" | "accent";

const HERO_TONE_CYCLE: HeroStatTone[] = ["urgent", "warning", "success", "info", "accent"];

function firstNameFromDisplay(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** e.g. CHAPTER_PRESIDENT → Chapter President */
function formatDashboardRoleLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildHeroMetricStrip(
  kpis: DashboardKpi[],
  nextActionCount: number,
  queueTotal: number,
  toolCount: number,
): { value: string | number; label: string; tone: HeroStatTone }[] {
  const out = kpis.slice(0, 5).map((k, i) => ({
    value: k.value,
    label: k.label,
    tone: HERO_TONE_CYCLE[i % HERO_TONE_CYCLE.length],
  }));
  const fillers: { value: number; label: string; tone: HeroStatTone }[] = [
    { value: nextActionCount, label: "Next actions", tone: "urgent" },
    { value: queueTotal, label: "Queue items", tone: "warning" },
    { value: toolCount, label: "Tools available", tone: "info" },
  ];
  for (const f of fillers) {
    if (out.length >= 5) break;
    if (!out.some((o) => o.label === f.label)) {
      out.push(f);
    }
  }
  return out.slice(0, 5);
}

export default async function OverviewPage() {
  const session = await getSession();

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

  const atRiskChapters = dashboard.role === "ADMIN"
    ? await getAtRiskChapters().catch(() => [])
    : [];

  const roleFocus: Record<string, string[]> = {
    ADMIN: [
      "Clear high-risk operational queues daily.",
      "Keep hiring, readiness, and waitlist motion visible.",
    ],
    CHAPTER_PRESIDENT: [
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

  const priorityTool = dashboard.sections[0]?.modules[0];
  const queueTotal = dashboard.queues.reduce((sum, queue) => sum + queue.count, 0);
  const toolCount = dashboard.sections.reduce((sum, section) => sum + section.modules.length, 0);
  const heroMetrics = buildHeroMetricStrip(
    dashboard.kpis,
    dashboard.nextActions.length,
    queueTotal,
    toolCount,
  );
  const roleFocusItems = roleFocus[dashboard.role] ?? roleFocus.STAFF;
  const todayDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const yearLabel = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(new Date());

  const userId = session.user.id;
  let unreadNotifications = 0;
  let unreadMessages = 0;
  try {
    [unreadNotifications, unreadMessages] = await Promise.all([
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      prisma.conversationParticipant
        .findMany({
          where: { userId },
          include: {
            conversation: {
              include: {
                messages: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { createdAt: true, senderId: true },
                },
              },
            },
          },
        })
        .then((parts) =>
          parts.filter((p) => {
            const latest = p.conversation.messages[0];
            return (
              !!latest &&
              latest.senderId !== userId &&
              latest.createdAt > p.lastReadAt
            );
          }).length,
        ),
    ]);
  } catch {
    unreadNotifications = 0;
    unreadMessages = 0;
  }

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
      detail: "See your momentum through pathways, KPIs, and role queues.",
      href: "/pathways/progress",
    },
  ];

  const howToUsePortal = [
    "Open your top Next Action first.",
    "Complete one task and log your update.",
    "Check your progress cards and repeat tomorrow.",
  ];

  const quickExperienceLinks =
    dashboard.role === "INSTRUCTOR"
      ? [
          {
            title: "My Workspace",
            description: "Manage curricula, offerings, and your teaching pathway.",
            href: "/instructor/workspace",
            tag: "WRK",
          },
          {
            title: "Training Academy",
            description: "Complete required modules and track your readiness progress.",
            href: "/instructor-training",
            tag: "TRN",
          },
          {
            title: "Curricula",
            description: "Create and submit class templates for review.",
            href: "/instructor/workspace?tab=curricula",
            tag: "CUR",
          },
          {
            title: "My Classes",
            description: "Review active class offerings, schedules, and enrollment.",
            href: "/instructor/class-settings",
            tag: "CLS",
          },
        ]
      : [
          {
            title: "My Chapter",
            description: "See your local pathways, next class step, and partner fallback options in one place.",
            href: "/my-chapter",
            tag: "CHP",
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
            title: "Pathways",
            description: "Track pathway progress and your next recommended steps.",
            href: "/pathways",
            tag: "PTH",
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
      detail: "Your queues, KPIs, and pathway progress update automatically.",
    },
  ];

  const displayName = session.user.name?.trim() || "there";
  const firstName = firstNameFromDisplay(displayName);
  const friendlyRole = formatDashboardRoleLabel(dashboard.role);
  const isStudent = dashboard.role === "STUDENT";
  const heroMetricsForLayout = isStudent ? heroMetrics.slice(0, 4) : heroMetrics;

  return (
    <div>
      <div className="topbar topbar-dashboard">
        <div>
          <h1 className="dashboard-page-title">
            {isStudent ? (
              <>
                Hi, <span className="dashboard-welcome-name">{firstName}</span>
              </>
            ) : (
              "Home Dashboard"
            )}
          </h1>
          <p className="dashboard-header-date">
            {isStudent ? (
              <>
                <span className="dashboard-header-role">{friendlyRole}</span>
                <span className="dashboard-header-sep" aria-hidden>
                  {" "}
                  ·{" "}
                </span>
                {todayDateLabel}
              </>
            ) : (
              <>
                {todayDateLabel}, {yearLabel}
              </>
            )}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <span className="dashboard-role-pill">{friendlyRole}</span>
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

      <div
        className={`overview-hero card${isStudent ? " overview-hero--student-compact" : ""}`}
      >
        <div className="overview-hero-orb overview-hero-orb-left" aria-hidden />
        <div className="overview-hero-orb overview-hero-orb-right" aria-hidden />
        <div className="overview-hero-content">
          {isStudent ? (
            <>
              <span className="overview-hero-kicker">{friendlyRole} home</span>
              <p className="overview-hero-copy overview-hero-copy--student">
                {dashboard.heroSubtitle}
              </p>
              <p className="overview-hero-note">
                <Link href="/learn" className="link">
                  Learn
                </Link>
                {" · "}
                <Link href="/curriculum" className="link">
                  Classes & pathways
                </Link>
              </p>
            </>
          ) : (
            <>
              <span className="overview-hero-kicker">Your portal guide</span>
              <h2 className="overview-hero-title">
                Welcome back, <span className="dashboard-welcome-name">{displayName}.</span>
              </h2>
              <p className="overview-hero-copy">
                {dashboard.role === "INSTRUCTOR"
                  ? "Training, class management, readiness gates, and teaching tools in one place. Start with your top next action—progress updates everywhere else."
                  : "Classes, challenges, incubator, and communication in one calm home. Pick one next action and the rest of the portal stays in sync."}
              </p>
              <p className="overview-hero-note">
                Need a broader tour?{" "}
                <Link href="/learn" className="link">
                  Open Learn
                </Link>{" "}
                or explore{" "}
                <Link href="/curriculum" className="link">
                  classes and pathways
                </Link>
                .
              </p>
            </>
          )}

          <div className={`overview-hero-stats${isStudent ? " overview-hero-stats--student" : ""}`}>
            {heroMetricsForLayout.map((m) => (
              <div
                key={`${m.label}-${String(m.value)}`}
                className={`overview-hero-stat stat-tone-${m.tone}`}
              >
                <span className="overview-hero-stat-label">{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>

          <div className={`overview-pillar-grid${isStudent ? " overview-pillar-grid--student" : ""}`}>
            {portalPillars.map((pillar) => (
              <Link key={pillar.title} href={pillar.href} className="overview-pillar-card">
                <span className="overview-pillar-title">{pillar.title}</span>
                <span className="overview-pillar-detail">{pillar.detail}</span>
              </Link>
            ))}
          </div>

          {isStudent ? (
            <div className="student-quick-links" aria-label="Quick links">
              {quickExperienceLinks.map((item) => (
                <Link key={item.href} href={item.href} className="student-quick-link">
                  <span className="student-quick-link-tag">{item.tag}</span>
                  {item.title}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {!isStudent ? (
        <>
          <div className="card overview-flow-card">
            <div className="overview-flow-header">
              <h3 style={{ margin: 0 }}>How Everything Connects</h3>
              <p style={{ margin: 0 }}>
                One completed action updates your dashboard cards, role queues, and progress signals.
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
        </>
      ) : null}

      {!isStudent ? (
        <RoleHero
          role={dashboard.role}
          title={dashboard.heroTitle}
          subtitle={dashboard.heroSubtitle}
        />
      ) : null}

      {/* Daily Checklist — what to do today */}
      {dashboard.checklist && dashboard.checklist.length > 0 && (
        <DailyChecklist items={dashboard.checklist} />
      )}

      {/* Smart Nudges — contextual encouragement */}
      {dashboard.nudges && dashboard.nudges.length > 0 && (
        <NudgeStrip nudges={dashboard.nudges} />
      )}

      {/* Journey Roadmap — visual progress timeline (hidden on condensed student home) */}
      {!isStudent && dashboard.journeyMilestones ? (
        <JourneyRoadmap milestones={dashboard.journeyMilestones} />
      ) : null}

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

      {/* Governance: At-Risk Chapters (Admin only) */}
      {dashboard.role === "ADMIN" && atRiskChapters.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <AtRiskPanel chapters={atRiskChapters} />
        </div>
      )}

      {dashboard.role === "STUDENT" && studentSnapshot ? (
        <div className="card student-dashboard-snapshot" style={{ marginTop: 16 }}>
          <div className="student-dashboard-snapshot-grid">
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>First week checklist</h3>
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
                  <Link key={item.text} href={item.href} className="student-checklist-row">
                    <span>{item.text}</span>
                    <span className={`student-checklist-status${item.done ? " is-done" : ""}`}>
                      {item.done ? "Done" : "To do"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Due soon (7 days)</h3>
              <div className="student-due-compact">
                <div className="student-due-row">
                  <span>Assignments due</span>
                  <strong>{studentSnapshot.dueAssignmentsNext7Days}</strong>
                </div>
                <div className="student-due-row">
                  <span>Sessions</span>
                  <strong>{studentSnapshot.upcomingSessionsNext7Days}</strong>
                </div>
                <div className="student-due-row">
                  <span>Training due</span>
                  <strong>{studentSnapshot.trainingDue}</strong>
                </div>
                <div className="student-due-row">
                  <span>Pathway steps</span>
                  <strong>{studentSnapshot.nextPathwaySteps}</strong>
                </div>
              </div>
              <div className="student-due-actions">
                <Link href="/curriculum" className="button secondary" style={{ fontSize: 13 }}>
                  Curriculum
                </Link>
                <Link href="/my-chapter" className="button secondary" style={{ fontSize: 13 }}>
                  My Chapter
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dashboard.role === "STUDENT" && dashboard.activePathways !== undefined && (
        <div style={{ marginTop: 16 }}>
          <PathwayWidget pathways={dashboard.activePathways} />
        </div>
      )}

      {dashboard.role === "INSTRUCTOR" && dashboard.instructorReadiness && (
        <div style={{ marginTop: 16 }}>
          <InstructorReadinessWidget summary={dashboard.instructorReadiness} />
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <details className="dashboard-about">
          <summary>About this dashboard</summary>
          <div className="dashboard-about-content">
            <p style={{ marginTop: 0, color: "var(--muted)" }}>
              Dashboard generated at {new Date(dashboard.generatedAt).toLocaleTimeString()}.
            </p>
            <p style={{ marginBottom: 8 }}>
              Use queue cards and next actions first; open the sidebar for the full tool list.
            </p>
            <p style={{ marginBottom: 0 }}>
              Need something specific? Use the sidebar sections and More menu.
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
