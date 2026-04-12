import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth-supabase";
import { ADMIN_SUBTYPE_LABELS, normalizeAdminSubtypes } from "@/lib/admin-subtypes";
import { getDashboardData } from "@/lib/dashboard/data";
import { isUnifiedAllToolsDashboardEnabled } from "@/lib/dashboard/flags";
import { getStudentProgressSnapshot } from "@/lib/student-progress-actions";
import { prisma } from "@/lib/prisma";
import {
  getUnreadDirectMessageCountCached,
  getUnreadNotificationCountCached,
} from "@/lib/server-request-cache";
import { listWorkflowHomeItems, listWorkflowMasterRows } from "@/lib/workflow";
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

function formatAbsoluteDate(value: Date | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function notificationTag(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstNameFromDisplay(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

async function MasterWorkflowSection() {
  const masterRows = await listWorkflowMasterRows();

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Master Dashboard</h2>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Progress across everyone currently tracked in the shared workflow system.
          </p>
        </div>
      </div>

      {masterRows.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Workflow items will appear here once people are routed into the shared dashboard.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {masterRows.map((row) => (
            <div
              key={row.subjectUserId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--surface)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(160px, 220px) minmax(220px, 2fr)", gap: 16, alignItems: "start" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{row.name}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Progress</p>
                  <div style={{ height: 10, borderRadius: 999, background: "var(--surface-hover)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${row.progressPercent}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--accent) 0%, #4f46e5 100%)",
                      }}
                    />
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>{row.progressPercent}% complete</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Remaining Tasks</p>
                  {row.remainingTasks.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>No remaining tasks.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {row.remainingTasks.map((task) => (
                        <div key={`${row.subjectUserId}-${task.title}`} style={{ fontSize: 14 }}>
                          <strong>{task.title}</strong>
                          <span style={{ color: "var(--muted)" }}>
                            {" "}· {formatAbsoluteDate(task.dueAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDashboardRoleLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function renderAdminWorkflowHome(params: {
  userId: string;
  roles: string[];
  adminSubtypes: string[];
}) {
  const isSuperAdmin = params.adminSubtypes.includes("SUPER_ADMIN");

  const [workflowItems, notifications, unreadNotifications] = await Promise.all([
    listWorkflowHomeItems({
      userId: params.userId,
      roles: params.roles,
      adminSubtypes: params.adminSubtypes,
    }),
    prisma.notification.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    getUnreadNotificationCountCached(params.userId),
  ]);

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Home</span>
          <h1 className="page-title">Your Portal Home</h1>
          <p className="page-subtitle">
            {todayLabel}. Start with the next action at the top, then clear notifications that need attention.
          </p>
        </div>
      </div>

      {params.adminSubtypes.length === 0 ? (
        <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Waiting for Admin Subtype Assignment</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Your account has the base admin role, but no admin subtype has been assigned yet. Until that happens, this page stays in a minimal queue mode.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Active admin types:{" "}
            <strong>
              {params.adminSubtypes.map((subtype) => ADMIN_SUBTYPE_LABELS[subtype as keyof typeof ADMIN_SUBTYPE_LABELS] ?? subtype).join(", ")}
            </strong>
          </p>
        </div>
      )}

      <div className="grid two" style={{ alignItems: "start" }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Next Actions</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Assigned work for your current role and workflow ownership.
              </p>
            </div>
            <span className="badge">{workflowItems.length}</span>
          </div>

          {workflowItems.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              You do not have any assigned workflow items right now.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {workflowItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="workflow-home-card"
                  style={{ display: "block", color: "inherit", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="pill pill-small pill-info">{formatStage(item.stage)}</span>
                        <span className="pill pill-small">{item.kind.replace(/_/g, " ")}</span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{item.title}</p>
                      {item.summary ? (
                        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>{item.summary}</p>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Open</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
                    Deadline to action: {formatAbsoluteDate(item.dueAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Notifications</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Recent portal alerts with exact dates.
              </p>
            </div>
            <span className="badge">{unreadNotifications} unread</span>
          </div>

          {notifications.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              You do not have any notifications right now.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.link || "/notifications"}
                  className="workflow-home-card"
                  style={{ display: "block", color: "inherit", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="pill pill-small">{notificationTag(notification.type)}</span>
                        {!notification.isRead ? (
                          <span className="pill pill-small pill-attention">Unread</span>
                        ) : null}
                      </div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{notification.title}</p>
                      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>{notification.body}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Open</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
                    Posted: {formatAbsoluteDate(notification.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {isSuperAdmin ? (
        <Suspense
          fallback={(
            <section className="card" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Master Dashboard</h2>
                  <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                    Progress across everyone currently tracked in the shared workflow system.
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Loading the shared workflow summary...
              </p>
            </section>
          )}
        >
          <MasterWorkflowSection />
        </Suspense>
      ) : null}
    </div>
  );
}

export default async function OverviewPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const adminSubtypes = normalizeAdminSubtypes(
    ((session.user as { adminSubtypes?: string[] }).adminSubtypes ?? [])
  );

  if (roles.includes("ADMIN")) {
    return renderAdminWorkflowHome({
      userId: session.user.id,
      roles,
      adminSubtypes,
    });
  }

  if (!isUnifiedAllToolsDashboardEnabled()) {
    return <LegacyOverviewPage />;
  }

  const dashboard = await getDashboardData(
    session.user.id,
    session.user.primaryRole ?? null
  );
  const activeRoles = roles.length
    ? roles
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
      getUnreadNotificationCountCached(userId),
      getUnreadDirectMessageCountCached(userId),
    ]);
  } catch {
    unreadNotifications = 0;
    unreadMessages = 0;
  }

  const displayName = session.user.name?.trim() || "there";
  const firstName = firstNameFromDisplay(displayName);
  const friendlyRole = formatDashboardRoleLabel(dashboard.role);
  const isStudent = dashboard.role === "STUDENT";

  if (isStudent) {
    let recentNotifications: {
      id: string;
      title: string;
      body: string;
      link: string | null;
      isRead: boolean;
      createdAt: string;
      type: string;
    }[] = [];

    try {
      const rows = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          body: true,
          link: true,
          isRead: true,
          createdAt: true,
          type: true,
        },
      });
      recentNotifications = rows.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }));
    } catch {
      recentNotifications = [];
    }

    return (
      <StudentHome
        firstName={firstName}
        roleLabel={formatDashboardRoleLabel("STUDENT")}
        todayDateLabel={todayDateLabel}
        unreadNotifications={unreadNotifications}
        snapshot={studentSnapshot}
        nextActions={dashboard.nextActions}
        recentNotifications={recentNotifications}
      />
    );
  }

  return (
    <div>
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

      <RoleHero
        role={dashboard.role}
        title={dashboard.heroTitle}
        subtitle={dashboard.heroSubtitle}
      />

      {dashboard.checklist && dashboard.checklist.length > 0 ? (
        <DailyChecklist items={dashboard.checklist} />
      ) : null}

      {dashboard.nudges && dashboard.nudges.length > 0 ? (
        <NudgeStrip nudges={dashboard.nudges} />
      ) : null}

      {dashboard.journeyMilestones ? (
        <JourneyRoadmap milestones={dashboard.journeyMilestones} />
      ) : null}

      <NextActions actions={dashboard.nextActions} />

      <QueueBoard queues={dashboard.queues} />

      <KpiStrip kpis={dashboard.kpis} />

      {dashboard.role === "ADMIN" && atRiskChapters.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <AtRiskPanel chapters={atRiskChapters} />
        </div>
      ) : null}

      {dashboard.role === "INSTRUCTOR" && dashboard.instructorReadiness ? (
        <div style={{ marginTop: 16 }}>
          <InstructorReadinessWidget summary={dashboard.instructorReadiness} />
        </div>
      ) : null}
    </div>
  );
}
