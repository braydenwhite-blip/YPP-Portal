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
import InstructorReadinessWidget from "@/components/dashboard/instructor-readiness-widget";
import DailyChecklist from "@/components/dashboard/daily-checklist";
import JourneyRoadmap from "@/components/dashboard/journey-roadmap";
import NudgeStrip from "@/components/dashboard/nudge-strip";
import AtRiskPanel from "@/components/dashboard/at-risk-panel";
import { getAtRiskChapters } from "@/lib/governance/actions";
import LegacyOverviewPage from "./legacy-overview-page";
import StudentHome from "@/components/dashboard/student-home";

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

function firstNameFromDisplay(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function formatDashboardRoleLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

  const todayDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

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

  const displayName = session.user.name?.trim() || "there";
  const firstName = firstNameFromDisplay(displayName);
  const friendlyRole = formatDashboardRoleLabel(dashboard.role);
  const isStudent = dashboard.role === "STUDENT";

  // Students get a dedicated home page
  if (isStudent) {
    return (
      <StudentHome
        firstName={firstName}
        todayDateLabel={todayDateLabel}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        snapshot={studentSnapshot}
        pathways={dashboard.activePathways ?? []}
        kpis={dashboard.kpis}
        nextActions={dashboard.nextActions}
        queues={dashboard.queues}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="topbar topbar-dashboard">
        <div>
          <h1 className="dashboard-page-title">Home Dashboard</h1>
          <p className="dashboard-header-date">
            <span className="dashboard-header-role">{friendlyRole}</span>
            <span className="dashboard-header-sep" aria-hidden> · </span>
            {todayDateLabel}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <span className="dashboard-role-pill">{friendlyRole}</span>
          <Link
            href="/messages"
            className={`dashboard-header-icon-btn${unreadMessages > 0 ? " has-unread" : ""}`}
            aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages > 99 ? "99+" : unreadMessages} unread` : "Messages"}
          >
            ✉
          </Link>
          <Link
            href="/notifications"
            className={`dashboard-header-icon-btn${unreadNotifications > 0 ? " has-unread" : ""}`}
            aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications > 99 ? "99+" : unreadNotifications} unread` : "Notifications"}
          >
            🔔
          </Link>
        </div>
      </div>

      {/* Launch / Rollout Banner */}
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
              <Link href={launchBanner.linkUrl} className="link">Open rollout resource</Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Role Hero */}
      <RoleHero
        role={dashboard.role}
        title={dashboard.heroTitle}
        subtitle={dashboard.heroSubtitle}
      />

      {/* Daily Checklist */}
      {dashboard.checklist && dashboard.checklist.length > 0 && (
        <DailyChecklist items={dashboard.checklist} />
      )}

      {/* Smart Nudges */}
      {dashboard.nudges && dashboard.nudges.length > 0 && (
        <NudgeStrip nudges={dashboard.nudges} />
      )}

      {/* Journey Roadmap */}
      {dashboard.journeyMilestones ? (
        <JourneyRoadmap milestones={dashboard.journeyMilestones} />
      ) : null}

      {/* PRIMARY: Next Actions */}
      <NextActions actions={dashboard.nextActions} />

      {/* Queue Board */}
      <QueueBoard queues={dashboard.queues} />

      {/* KPI Strip */}
      <KpiStrip kpis={dashboard.kpis} />

      {/* Governance: At-Risk Chapters (Admin only) */}
      {dashboard.role === "ADMIN" && atRiskChapters.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <AtRiskPanel chapters={atRiskChapters} />
        </div>
      )}

      {/* Instructor Readiness */}
      {dashboard.role === "INSTRUCTOR" && dashboard.instructorReadiness && (
        <div style={{ marginTop: 16 }}>
          <InstructorReadinessWidget summary={dashboard.instructorReadiness} />
        </div>
      )}
    </div>
  );
}
