import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getInstructorOfferings,
  getInstructorTemplates,
} from "@/lib/class-management-actions";
import { getInstructorReadiness } from "@/lib/instructor-readiness";
import { WorkspaceCreateButton } from "@/components/workspace-create-button";

/* ----------------------------- date helpers ----------------------------- */

function timeOfDayGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

function relativeDay(date: Date, today: Date): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return raw;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const meridiem = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${meridiem}`;
}

/* ------------------------------ action queue ----------------------------- */

type ActionPriority = "critical" | "high" | "info";

type ActionItem = {
  key: string;
  priority: ActionPriority;
  icon: string;
  title: string;
  detail: string;
  href: string;
  tag: string;
};

const PRIORITY_RANK: Record<ActionPriority, number> = {
  critical: 0,
  high: 1,
  info: 2,
};

/* -------------------------------- component ------------------------------ */

export async function InstructorDashboard({
  userId,
  name,
  topSlot,
}: {
  userId: string;
  name: string;
  /** Optional content rendered just under the hero (e.g. People Strategy cards). */
  topSlot?: ReactNode;
}) {
  const now = new Date();
  const today = startOfDay(now);
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [
    offerings,
    readiness,
    templates,
    lessonPlans,
    drafts,
    upcomingSessions,
    pastSessions,
    awaitingFeedback,
    menteeCount,
  ] = await Promise.all([
    getInstructorOfferings(userId).catch(() => []),
    getInstructorReadiness(userId).catch(() => null),
    getInstructorTemplates(userId).catch(() => []),
    prisma.lessonPlan
      .findMany({
        where: { authorId: userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, updatedAt: true, totalMinutes: true },
      })
      .catch(() => []),
    prisma.curriculumDraft
      .findMany({
        where: { authorId: userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      })
      .catch(() => []),
    prisma.classSession
      .findMany({
        where: {
          offering: { instructorId: userId },
          isCancelled: false,
          date: { gte: today },
        },
        orderBy: { date: "asc" },
        take: 8,
        select: {
          id: true,
          date: true,
          startTime: true,
          topic: true,
          offering: { select: { id: true, title: true } },
        },
      })
      .catch(() => []),
    prisma.classSession
      .findMany({
        where: {
          offering: {
            instructorId: userId,
            status: { in: ["PUBLISHED", "IN_PROGRESS"] },
          },
          isCancelled: false,
          date: { gte: twoWeeksAgo, lt: today },
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          topic: true,
          offering: { select: { id: true, title: true } },
          _count: { select: { attendance: true } },
        },
      })
      .catch(() => []),
    prisma.classAssignmentSubmission
      .findMany({
        where: {
          submittedAt: { not: null },
          feedbackGivenAt: null,
          assignment: { offering: { instructorId: userId } },
        },
        take: 200,
        select: {
          assignment: {
            select: {
              offeringId: true,
              offering: { select: { title: true } },
            },
          },
        },
      })
      .catch(() => [] as { assignment: { offeringId: string; offering: { title: string } } }[]),
    prisma.mentorship
      .count({ where: { mentorId: userId, status: "ACTIVE" } })
      .catch(() => 0),
  ]);

  /* ---- derived stats ---- */

  const activeOfferings = offerings.filter(
    (o) => o.status === "PUBLISHED" || o.status === "IN_PROGRESS",
  );
  const draftOfferings = offerings.filter((o) => o.status === "DRAFT");
  const completedOfferings = offerings.filter((o) => o.status === "COMPLETED");
  const totalStudents = activeOfferings.reduce(
    (sum, o) => sum + (o._count?.enrollments ?? 0),
    0,
  );
  const sessionsThisWeek = upcomingSessions.filter((s) => s.date < weekAhead);
  const needsRollCall = pastSessions
    .filter((s) => s._count.attendance === 0)
    .slice(0, 3);

  /* ---- feedback grouped by offering ---- */

  const feedbackByOffering = new Map<string, { title: string; count: number }>();
  for (const sub of awaitingFeedback) {
    const id = sub.assignment.offeringId;
    const existing = feedbackByOffering.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      feedbackByOffering.set(id, {
        title: sub.assignment.offering.title,
        count: 1,
      });
    }
  }

  /* ---- build the action queue ---- */

  const actions: ActionItem[] = [];

  for (const req of readiness?.missingRequirements ?? []) {
    actions.push({
      key: `readiness-${req.code}`,
      priority: "critical",
      icon: "⚠️",
      title: req.title,
      detail: req.detail,
      href: req.href,
      tag: "Readiness",
    });
  }

  for (const offering of offerings) {
    const status = offering.approval?.status;
    if (status === "CHANGES_REQUESTED" || status === "REJECTED") {
      actions.push({
        key: `approval-${offering.id}`,
        priority: "high",
        icon: "📝",
        title:
          status === "REJECTED"
            ? `"${offering.title}" approval was declined`
            : `"${offering.title}" needs changes before approval`,
        detail:
          offering.approval?.reviewNotes?.trim() ||
          "Open class settings to review the approver's notes and resubmit.",
        href: "/instructor/class-settings",
        tag: "Approval",
      });
    }
  }

  for (const [offeringId, info] of feedbackByOffering) {
    actions.push({
      key: `feedback-${offeringId}`,
      priority: "high",
      icon: "✍️",
      title: `${info.count} submission${info.count === 1 ? "" : "s"} awaiting your feedback`,
      detail: `Students in ${info.title} are waiting to hear back from you.`,
      href: `/curriculum/${offeringId}`,
      tag: "Feedback",
    });
  }

  for (const session of needsRollCall) {
    actions.push({
      key: `rollcall-${session.id}`,
      priority: "info",
      icon: "📋",
      title: `Log attendance for "${session.topic}"`,
      detail: `${session.offering.title} · met ${session.date.toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" },
      )}`,
      href: `/curriculum/${session.offering.id}`,
      tag: "Attendance",
    });
  }

  actions.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const visibleActions = actions.slice(0, 6);
  const hiddenActionCount = actions.length - visibleActions.length;
  const criticalCount = actions.filter((a) => a.priority === "critical").length;

  /* ---- "jump back in" — most recent in-progress work ---- */

  type RecentItem = {
    key: string;
    label: string;
    meta: string;
    href: string;
    icon: string;
    updatedAt: Date;
  };
  const recentWork: RecentItem[] = [];
  const topDraft = drafts[0];
  if (topDraft) {
    recentWork.push({
      key: `draft-${topDraft.id}`,
      label: topDraft.title?.trim() || "Untitled curriculum draft",
      meta: `Curriculum draft · ${topDraft.status.replace(/_/g, " ").toLowerCase()}`,
      href: `/instructor/lesson-design-studio?draftId=${topDraft.id}`,
      icon: "🎨",
      updatedAt: topDraft.updatedAt,
    });
  }
  const topPlan = lessonPlans[0];
  if (topPlan) {
    recentWork.push({
      key: `plan-${topPlan.id}`,
      label: topPlan.title?.trim() || "Untitled lesson plan",
      meta: `Lesson plan · ${topPlan.totalMinutes} min`,
      href: "/lesson-plans",
      icon: "📋",
      updatedAt: topPlan.updatedAt,
    });
  }
  const topTemplate = templates[0];
  if (topTemplate) {
    recentWork.push({
      key: `template-${topTemplate.id}`,
      label: topTemplate.title,
      meta: `Curriculum · ${topTemplate.durationWeeks} weeks`,
      href: `/instructor/curriculum-builder#edit-${topTemplate.id}`,
      icon: "🛠️",
      updatedAt: topTemplate.updatedAt,
    });
  }
  recentWork.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  /* ---- hero status line ---- */

  const nextSession = upcomingSessions[0];
  let heroStatus: string;
  if (nextSession) {
    const when = relativeDay(nextSession.date, today).toLowerCase();
    heroStatus = `Your next session — ${nextSession.topic} — is ${
      when === "today" || when === "tomorrow" ? when : `on ${when}`
    } at ${formatTime(nextSession.startTime)}.`;
  } else if (readiness && !readiness.baseReadinessComplete) {
    heroStatus =
      "Work through your readiness steps below to unlock publishing and start teaching.";
  } else if (activeOfferings.length > 0) {
    heroStatus =
      "No sessions on the calendar this week — a good moment to plan ahead or refine a lesson.";
  } else {
    heroStatus =
      "Ready when you are. Build a curriculum and publish your first class to get started.";
  }

  /* ------------------------------- render -------------------------------- */

  return (
    <div className="dash">
      {/* Hero */}
      <header className="dash-hero" data-tour="dashboard">
        <div>
          <h1 className="dash-hero-greeting">
            {timeOfDayGreeting(now)}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="dash-hero-date">{formatFullDate(now)}</p>
          <p className="dash-hero-status">{heroStatus}</p>
        </div>
        <div className="dash-hero-actions">
          <WorkspaceCreateButton />
          <Link href="/instructor/workspace" className="button secondary">
            Open Workspace
          </Link>
        </div>
      </header>

      {topSlot}

      {/* KPI strip */}
      <div className="grid four">
        <div className="card">
          <div className="kpi">{activeOfferings.length}</div>
          <div className="kpi-label">Active Classes</div>
        </div>
        <div className="card">
          <div className="kpi">{totalStudents}</div>
          <div className="kpi-label">Students Enrolled</div>
        </div>
        <div className="card">
          <div className="kpi">{sessionsThisWeek.length}</div>
          <div className="kpi-label">Sessions This Week</div>
        </div>
        <div className="card">
          <div
            className="kpi"
            style={
              criticalCount > 0 ? { color: "var(--error-color)" } : undefined
            }
          >
            {actions.length}
          </div>
          <div className="kpi-label">Action Items</div>
        </div>
      </div>

      {/* Action queue */}
      <section className="card">
        <div className="dash-section-head">
          <h2>Needs your attention</h2>
          {actions.length > 0 ? (
            <span className="dash-section-link">
              {criticalCount > 0
                ? `${criticalCount} need${criticalCount === 1 ? "s" : ""} action now`
                : `${actions.length} open`}
            </span>
          ) : null}
        </div>
        {visibleActions.length === 0 ? (
          <div className="callout is-success">
            <span className="callout-icon" aria-hidden="true">
              {"✨"}
            </span>
            <span>
              You&apos;re all caught up — no readiness blockers, pending
              approvals, or feedback waiting. Nice work.
            </span>
          </div>
        ) : (
          <div className="action-list">
            {visibleActions.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className={`action-item is-${action.priority}`}
              >
                <span className="action-item-icon" aria-hidden="true">
                  {action.icon}
                </span>
                <span className="action-item-body">
                  <span className="action-item-title">{action.title}</span>
                  <span className="action-item-detail">{action.detail}</span>
                </span>
                <span className={`action-item-tag is-${action.priority}`}>
                  {action.tag}
                </span>
              </Link>
            ))}
            {hiddenActionCount > 0 ? (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                + {hiddenActionCount} more item{hiddenActionCount === 1 ? "" : "s"} to review.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Schedule + classes */}
      <div className="grid two">
        <section className="card" data-tour="session-logging">
          <div className="dash-section-head">
            <h2>This week</h2>
            <Link href="/scheduling" className="dash-section-link">
              Scheduling hub
            </Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <div className="empty-state" style={{ padding: "26px 16px" }}>
              <span className="empty-state-icon" aria-hidden="true">
                {"📅"}
              </span>
              <p className="empty-state-title">No upcoming sessions</p>
              <p className="empty-state-text">
                {activeOfferings.length > 0
                  ? "None of your classes meet in the next stretch. Use the time to plan ahead."
                  : "Sessions appear here once you publish a class with a schedule."}
              </p>
            </div>
          ) : (
            <div className="action-list">
              {upcomingSessions.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/curriculum/${session.offering.id}`}
                  className="dash-row"
                >
                  <span className="dash-row-date">
                    <span className="dash-row-date-month">
                      {session.date.toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </span>
                    <span className="dash-row-date-day">
                      {session.date.getDate()}
                    </span>
                  </span>
                  <span className="dash-row-body">
                    <span className="dash-row-title">{session.topic}</span>
                    <span className="dash-row-meta">
                      {relativeDay(session.date, today)} at{" "}
                      {formatTime(session.startTime)} · {session.offering.title}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card" data-tour="course-materials">
          <div className="dash-section-head">
            <h2>My classes</h2>
            <Link
              href="/instructor/workspace?tab=offerings"
              className="dash-section-link"
            >
              View all
            </Link>
          </div>
          {activeOfferings.length === 0 && draftOfferings.length === 0 ? (
            <div className="empty-state" style={{ padding: "26px 16px" }}>
              <span className="empty-state-icon" aria-hidden="true">
                {"🏫"}
              </span>
              <p className="empty-state-title">No classes yet</p>
              <p className="empty-state-text">
                Build a curriculum, then publish it as an offering students can
                enroll in.
              </p>
              <Link
                href="/instructor/curriculum-builder"
                className="button primary"
              >
                Build a curriculum
              </Link>
            </div>
          ) : (
            <div className="action-list">
              {activeOfferings.slice(0, 4).map((offering) => (
                <Link
                  key={offering.id}
                  href={`/curriculum/${offering.id}`}
                  className="dash-row"
                >
                  <span className="dash-row-body">
                    <span className="dash-row-title">{offering.title}</span>
                    <span className="dash-row-meta">
                      {offering.meetingDays.join(", ") || "Schedule TBD"}
                      {offering.meetingTime ? ` · ${offering.meetingTime}` : ""}
                    </span>
                  </span>
                  <span className="dash-row-aside">
                    {offering._count?.enrollments ?? 0} enrolled
                  </span>
                </Link>
              ))}
              {draftOfferings.slice(0, 2).map((offering) => (
                <Link
                  key={offering.id}
                  href="/instructor/class-settings"
                  className="dash-row"
                >
                  <span className="dash-row-body">
                    <span className="dash-row-title">{offering.title}</span>
                    <span className="dash-row-meta">
                      Draft · not yet published
                    </span>
                  </span>
                  <span className="dash-row-aside">Finish setup</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Jump back in + impact */}
      <div className="grid two">
        <section className="card">
          <div className="dash-section-head">
            <h2>Jump back in</h2>
          </div>
          {recentWork.length === 0 ? (
            <div className="empty-state" style={{ padding: "26px 16px" }}>
              <span className="empty-state-icon" aria-hidden="true">
                {"✏️"}
              </span>
              <p className="empty-state-title">Nothing in progress</p>
              <p className="empty-state-text">
                Start a curriculum draft or a lesson plan and it will show up
                here so you can pick up where you left off.
              </p>
              <Link
                href="/instructor/lesson-design-studio"
                className="button primary"
              >
                Open Lesson Design Studio
              </Link>
            </div>
          ) : (
            <div className="action-list">
              {recentWork.map((item) => (
                <Link key={item.key} href={item.href} className="dash-row">
                  <span className="action-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="dash-row-body">
                    <span className="dash-row-title">{item.label}</span>
                    <span className="dash-row-meta">{item.meta}</span>
                  </span>
                  <span className="dash-row-aside">Resume</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card" data-tour="community">
          <div className="dash-section-head">
            <h2>Your teaching impact</h2>
            <Link href="/instructor-growth" className="dash-section-link">
              Growth record
            </Link>
          </div>
          <div className="impact-grid">
            <div className="impact-stat">
              <div className="impact-stat-value">
                {completedOfferings.length}
              </div>
              <div className="impact-stat-label">Classes completed</div>
            </div>
            <div className="impact-stat">
              <div className="impact-stat-value">{totalStudents}</div>
              <div className="impact-stat-label">Students this term</div>
            </div>
            <div className="impact-stat">
              <div className="impact-stat-value">{templates.length}</div>
              <div className="impact-stat-label">Curricula authored</div>
            </div>
            <div className="impact-stat">
              <div className="impact-stat-value">{menteeCount}</div>
              <div className="impact-stat-label">Active mentees</div>
            </div>
          </div>
          {readiness && readiness.baseReadinessComplete ? (
            <div className="callout is-success" style={{ marginTop: 14 }}>
              <span className="callout-icon" aria-hidden="true">
                {"🎓"}
              </span>
              <span>
                Readiness complete — you&apos;re cleared to design curricula and
                request approval to publish.
              </span>
            </div>
          ) : null}
        </section>
      </div>

      {/* Tools */}
      <section className="card">
        <div className="dash-section-head">
          <h2>Teaching tools</h2>
        </div>
        <div className="tool-grid">
          {[
            {
              href: "/instructor/workspace",
              icon: "🧩",
              label: "Workspace",
              desc: "Curricula, plans & offerings",
            },
            {
              href: "/instructor/curriculum-builder",
              icon: "🛠️",
              label: "Curriculum Builder",
              desc: "Design a course",
            },
            {
              href: "/instructor/lesson-design-studio",
              icon: "🎨",
              label: "Lesson Design Studio",
              desc: "Guided lesson design",
            },
            {
              href: "/lesson-plans",
              icon: "📋",
              label: "Lesson Plans",
              desc: "Draft session plans",
            },
            {
              href: "/instructor/class-settings",
              icon: "⚙️",
              label: "Class Settings",
              desc: "Offerings & publishing",
            },
            {
              href: "/attendance",
              icon: "✅",
              label: "Attendance",
              desc: "Track roll call",
            },
            {
              href: "/scheduling",
              icon: "🗓️",
              label: "Scheduling",
              desc: "Sessions & calendar",
            },
            {
              href: "/messages",
              icon: "✉️",
              label: "Messages",
              desc: "Reach students & families",
            },
          ].map((tool) => (
            <Link key={tool.href} href={tool.href} className="tool-tile">
              <span className="tool-tile-icon" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="tool-tile-label">{tool.label}</span>
              <span className="tool-tile-desc">{tool.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
