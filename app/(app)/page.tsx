import type { ReactNode } from "react";
import Link from "next/link";
import { isPublicGateEnabled, isOfficerTierFromAuth } from "@/lib/public-gate";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { cookies } from "next/headers";
import {
  ACTIONS_ONLY_PREVIEW_COOKIE_NAME,
  isActionsOnlyPreviewActive,
} from "@/lib/leadership-preview-access";
import {
  getHiringDemoHomeHref,
  isHiringDemoModeEnabled,
} from "@/lib/hiring-demo-mode";
import { InstructorTeachingHome } from "@/components/instructor/instructor-teaching-home";
import { loadInstructorTeachingWorkspace } from "@/lib/classes/instructor-workspace";
import { getStudentProgressSnapshot } from "@/lib/student-progress-actions";
import { getMyClassesHubData } from "@/lib/student-class-portal";
import { getStudentChapterJourneyData } from "@/lib/chapter-pathway-journey";
import {
  getUnreadDirectMessageCountCached,
  getUnreadNotificationCountCached,
} from "@/lib/server-request-cache";
import type { ActivePathwaySummary } from "@/lib/dashboard/types";
import StudentDashboard, {
  type StudentHomeNextSession,
} from "@/components/dashboard/student-dashboard";
import MyActionsCard from "@/components/people-strategy/my-actions-card";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadLeadershipHome } from "@/lib/home/leadership-home";
import { LeadershipHome } from "@/components/home/leadership-home";
import { APPLICATION_REVIEWER_ROLES } from "@/lib/org/role-sets";

// Roles that work the hiring pipeline and should land on the applicant board.
const REVIEWER_ROLES: readonly string[] = APPLICATION_REVIEWER_ROLES;

function firstName(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function HomeShell({
  greeting,
  intro,
  children,
}: {
  greeting: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 540, margin: "72px auto 96px", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>{greeting}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 24px" }}>
        {intro}
      </p>
      {children}
    </div>
  );
}

function PrimaryCard({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="card"
      style={{ display: "block", padding: "22px 24px", textDecoration: "none", color: "inherit" }}
    >
      <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{title}</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
        {body}
      </p>
      <span className="button small" style={{ pointerEvents: "none" }}>
        {cta}
      </span>
    </Link>
  );
}

function ReviewerHome({
  name,
  gateEnabled,
  actionsCard,
}: {
  name: string;
  gateEnabled: boolean;
  actionsCard?: ReactNode;
}) {
  return (
    <HomeShell
      greeting={name ? `Hi, ${name}.` : "Welcome back."}
      intro="The application board is the one page that's ready to use. The rest of the portal is still being tested."
    >
      <PrimaryCard
        href="/admin/instructor-applicants"
        title="Application board"
        body="Review instructor applicants and move them through the hiring pipeline."
        cta="Open the board"
      />
      {actionsCard ? <div style={{ marginTop: 20 }}>{actionsCard}</div> : null}
      {gateEnabled && (
        <div style={{ marginTop: 20 }}>
          <Link
            href="/preview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 8,
              background: "#6b21c8",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 16 }}>🔑</span>
            Enter the preview passcode
          </Link>
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            Unlock the rest of the portal on this device.
          </p>
        </div>
      )}
    </HomeShell>
  );
}

function ActionsOnlyPreviewHome({ name }: { name: string }) {
  return (
    <HomeShell
      greeting={name ? `Hi, ${name}.` : "Welcome back."}
      intro="You're previewing the Actions tracker. Use Home for a quick overview, or jump straight into your action list."
    >
      <PrimaryCard
        href="/actions"
        title="Actions"
        body="See what's assigned to you, update status, and tag teammates in comments."
        cta="Open Actions"
      />
    </HomeShell>
  );
}

function ApplicantHome({ name }: { name: string }) {
  return (
    <HomeShell
      greeting={name ? `Hi, ${name}.` : "Welcome back."}
      intro="Check where your application stands below. The rest of the portal is still being tested."
    >
      <PrimaryCard
        href="/application-status"
        title="Your application"
        body="See your current status and respond to anything the team has asked for."
        cta="View status"
      />
      <p style={{ marginTop: 20, fontSize: 13, color: "var(--muted)" }}>
        Haven&apos;t applied yet?{" "}
        <Link href="/applications/summer-workshop" style={{ color: "#6b21c8", fontWeight: 600 }}>
          Start an application
        </Link>
        .
      </p>
    </HomeShell>
  );
}

/** "16:00" -> "4:00 PM". Passes through anything that isn't HH:MM. */
function formatTime(raw: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${meridiem}`;
}

function relativeDayLabel(
  date: Date,
  now: Date,
): { label: string; isToday: boolean } {
  const startOfDay = (value: Date) => {
    const next = new Date(value);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const diffDays = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return { label: "Today", isToday: true };
  if (diffDays === 1) return { label: "Tomorrow", isToday: false };
  return {
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date),
    isToday: false,
  };
}

async function StudentHomeView({ userId, name }: { userId: string; name: string }) {
  const now = new Date();
  const [snapshot, hub, journey, unreadNotifications, unreadMessages] =
    await Promise.all([
      getStudentProgressSnapshot(userId).catch(() => null),
      getMyClassesHubData(userId).catch(() => null),
      getStudentChapterJourneyData(userId).catch(() => null),
      getUnreadNotificationCountCached(userId).catch(() => 0),
      getUnreadDirectMessageCountCached(userId).catch(() => 0),
    ]);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  let nextSession: StudentHomeNextSession | null = null;
  if (hub?.nextSession) {
    const session = hub.nextSession;
    const { label, isToday } = relativeDayLabel(session.date, now);
    nextSession = {
      classTitle: session.classTitle,
      topic: session.topic,
      dateLabel: label,
      timeLabel: `${formatTime(session.startTime)} – ${formatTime(session.endTime)}`,
      isToday,
      classHref: `/curriculum/${session.offeringId}`,
      zoomLink: session.zoomLink,
      instructorName: session.instructorName,
    };
  }

  const pathways: ActivePathwaySummary[] = (journey?.visiblePathways ?? [])
    .filter((pathway) => pathway.isEnrolled || pathway.completedCount > 0)
    .slice(0, 4)
    .map((pathway) => ({
      id: pathway.id,
      name: pathway.name,
      interestArea: pathway.interestArea,
      progressPercent: pathway.progressPercent,
      completedCount: pathway.completedCount,
      totalCount: pathway.totalCount,
      nextStepTitle: pathway.nextRecommendedStep?.title ?? null,
    }));

  return (
    <StudentDashboard
      firstName={name}
      greeting={greeting}
      todayDateLabel={todayDateLabel}
      unreadMessages={unreadMessages}
      unreadNotifications={unreadNotifications}
      snapshot={snapshot}
      nextSession={nextSession}
      pathways={pathways}
    />
  );
}

export default async function OverviewPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (isHiringDemoModeEnabled()) {
    redirect(
      getHiringDemoHomeHref({
        primaryRole: session.user.primaryRole,
        roles: session.user.roles ?? [],
      })
    );
  }

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isInstructor =
    roles.includes("INSTRUCTOR") || session.user.primaryRole === "INSTRUCTOR";
  // Instructors must never land on the application board. A reviewer role only
  // routes to the board when the viewer isn't also an instructor — the lone
  // exception is full ADMINs, who keep the board even when they teach.
  const isReviewer =
    isAdmin || (roles.some((role) => REVIEWER_ROLES.includes(role)) && !isInstructor);
  const name = firstName(session.user.name);
  const officerBypassesPublicGate = isOfficerTierFromAuth(
    roles,
    session.user.primaryRole
  );
  const showPreviewUnlockLink =
    isPublicGateEnabled() && !officerBypassesPublicGate;

  // Compact People Strategy queue card. The card self-gates on the feature
  // flag and renders nothing when the viewer has no actions.
  const actionViewer: ActionViewer = {
    id: session.user.id,
    roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const previewViewer = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles,
    primaryRole: session.user.primaryRole,
    internalLevel: session.user.internalLevel,
  };
  const cookieStore = await cookies();
  const actionsOnlyPreviewCookie =
    cookieStore.get(ACTIONS_ONLY_PREVIEW_COOKIE_NAME)?.value ?? null;
  const actionsOnlyPreview = isActionsOnlyPreviewActive(previewViewer, {
    previewCookie: actionsOnlyPreviewCookie,
    allowAdminPreviewCookie: officerBypassesPublicGate,
  });

  if (actionsOnlyPreview) {
    return <ActionsOnlyPreviewHome name={name} />;
  }

  if (isReviewer) {
    // Leadership Home cockpit (Knowledge OS V2, plan §7/§27.6) — the
    // executive front door. Falls back to the prior minimal reviewer home if
    // the cockpit loaders fail, so leadership never lands on an error page.
    try {
      const cockpit = await loadLeadershipHome(actionViewer);
      return (
        <>
          <LeadershipHome firstName={name} userId={session.user.id} data={cockpit} />
          {showPreviewUnlockLink && (
            <p style={{ maxWidth: 1280, margin: "16px auto 0" }}>
              <Link
                href="/preview"
                style={{ fontSize: 13, fontWeight: 600, color: "#6b21c8" }}
              >
                🔑 Enter the preview passcode to unlock the rest of the portal on
                this device
              </Link>
            </p>
          )}
        </>
      );
    } catch (error) {
      console.error("[home] leadership cockpit failed, using fallback:", error);
      return (
        <ReviewerHome
          name={name}
          gateEnabled={showPreviewUnlockLink}
          actionsCard={<MyActionsCard viewer={actionViewer} />}
        />
      );
    }
  }

  if (isInstructor) {
    const teachingWorkspace = await loadInstructorTeachingWorkspace(session.user.id);
    return <InstructorTeachingHome name={name} workspace={teachingWorkspace} />;
  }

  if (roles.includes("STUDENT")) {
    return <StudentHomeView userId={session.user.id} name={name} />;
  }

  return <ApplicantHome name={name} />;
}
