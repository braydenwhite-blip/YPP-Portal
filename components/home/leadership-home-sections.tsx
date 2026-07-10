import Link from "next/link";

import type { LeadershipHomeData } from "@/lib/home/leadership-home";
import { HomeSearchButton } from "@/components/home/home-search-button";
import { MyWorkflowQueueCard } from "@/components/workflow-engine/my-workflow-queue-card";

/**
 * Leadership Home — the single, calm starting point.
 *
 * Plain-English answer to "what do I need to know or do today?", organized as a
 * few simple cards instead of an operating-system cockpit:
 *   Search · Common tasks · Needs attention · Upcoming meetings ·
 *   My actions · Recently opened · Browse all
 *
 * Every number and row links straight to the section that owns it, so the first
 * click is always obvious. No "Command Center", no density modes, no jargon.
 */

type QuickCreate = { label: string; href: string; icon: string };

const QUICK_CREATE: QuickCreate[] = [
  { label: "New action", href: "/actions/new", icon: "✅" },
  { label: "Log a meeting", href: "/actions/meetings/new", icon: "📅" },
  { label: "Add a partner", href: "/partners/new", icon: "🤝" },
  { label: "Find a person", href: "/people/find", icon: "👥" },
  { label: "New initiative", href: "/operations/initiatives/new", icon: "🎯" },
];

const SECTIONS: { label: string; href: string; icon: string; blurb: string }[] = [
  { label: "People", href: "/people", icon: "👥", blurb: "Find and understand anyone" },
  { label: "Programs", href: "/admin/classes", icon: "🎓", blurb: "Classes, cohorts, mentorship" },
  { label: "Meetings", href: "/meetings", icon: "📅", blurb: "Prep, run, follow up" },
  { label: "Actions", href: "/actions", icon: "✅", blurb: "Every action item" },
  { label: "Applicants", href: "/admin/instructor-applicants", icon: "📝", blurb: "Review workflows" },
  { label: "Partners", href: "/partners", icon: "🤝", blurb: "Camps, schools, orgs" },
  { label: "Chapters", href: "/admin/chapters", icon: "🏘", blurb: "Chapter operations" },
  { label: "Admin", href: "/admin", icon: "🛠", blurb: "Users and settings" },
];

function shortWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function Card({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[14px] border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[14px] font-semibold text-ink">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
          >
            {linkLabel ?? "View all"}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RowLink({
  href,
  title,
  detail,
  meta,
}: {
  href: string;
  title: string;
  detail?: string | null;
  meta?: string | null;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 no-underline transition-colors hover:bg-surface-soft"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink">{title}</span>
        {detail ? (
          <span className="block truncate text-[12px] text-ink-muted">{detail}</span>
        ) : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-[11.5px] font-medium text-ink-muted">{meta}</span>
      ) : null}
    </Link>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="m-0 px-2.5 py-2 text-[12.5px] text-ink-muted">{children}</p>;
}

export function LeadershipHomeSections({
  firstName,
  userId,
  data,
}: {
  firstName: string;
  userId: string;
  data: LeadershipHomeData;
}) {
  const { stats } = data;
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  // Needs-attention counts, each pointing at the list that owns it. Only the
  // non-zero ones render, worst first — calm, never a wall of red.
  const attentionStats: { label: string; count: number; href: string }[] = [
    { label: "Overdue actions", count: stats.overdueActions, href: "/actions?who=all" },
    { label: "Waiting on an owner", count: stats.unownedActions, href: "/actions?who=all" },
    { label: "Blocked actions", count: stats.blockedActions, href: "/actions?who=all" },
    { label: "Applicants awaiting a decision", count: stats.applicantsAwaitingDecision, href: "/admin/instructor-applicants/chair-queue" },
    { label: "Students without an advisor", count: stats.studentsWithoutAdvisor, href: "/operations/advising" },
    { label: "Advisor check-ins overdue", count: stats.advisorCheckInsOverdue, href: "/operations/advising" },
    { label: "Partner follow-ups due", count: stats.partnerFollowUpsOverdue, href: "/admin/partners" },
    { label: "New Chapter President applications", count: stats.newCpApplications, href: "/admin/instructor-applicants?kind=cp" },
    { label: "Chapters launching", count: stats.chaptersLaunching, href: "/admin/chapters?view=launching" },
    { label: "Chapter support requests", count: stats.chapterSupportOpen, href: "/admin/chapters?view=waiting_on_ypp" },
    { label: "Launch plans awaiting approval", count: stats.launchPlansPendingApproval, href: "/admin/chapters?view=waiting_on_ypp" },
    { label: "Chapters with no upcoming meeting", count: stats.chaptersNoUpcomingMeeting, href: "/admin/chapters?view=no_upcoming_meeting" },
    { label: "Overdue chapter actions", count: stats.overdueChapterActions, href: "/actions?who=all" },
  ].filter((item) => item.count > 0);

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8">
      <header className="mb-5">
        <h1 className="m-0 text-[24px] font-bold text-ink">{greeting}</h1>
        <p className="mt-1 mb-3 text-[14px] text-ink-muted">
          Here&rsquo;s what needs you today. Search for anyone or anything, or jump into a section.
        </p>
        <HomeSearchButton />
      </header>

      {/* Common tasks — one obvious place to create the work officers start most. */}
      <section className="mb-5 flex flex-wrap gap-2">
        {QUICK_CREATE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink no-underline shadow-card transition-colors hover:border-brand-400"
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Needs attention */}
        <Card title="Needs attention" href="/actions?who=all" linkLabel="Open actions">
          {attentionStats.length === 0 ? (
            <EmptyRow>You&rsquo;re all caught up — nothing needs attention right now.</EmptyRow>
          ) : (
            <div className="flex flex-col">
              {attentionStats.map((item) => (
                <RowLink
                  key={item.label}
                  href={item.href}
                  title={item.label}
                  meta={String(item.count)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming meetings */}
        <Card title="Upcoming meetings" href="/meetings">
          {data.upcomingMeetings.length === 0 ? (
            <EmptyRow>No meetings scheduled.</EmptyRow>
          ) : (
            <div className="flex flex-col">
              {data.upcomingMeetings.map((meeting) => (
                <RowLink
                  key={meeting.id}
                  href={meeting.href}
                  title={meeting.title}
                  detail={meeting.categoryLabel}
                  meta={shortWhen(meeting.startISO)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* My actions / waiting on me */}
        <Card title="Actions that need a move" href="/actions?who=all">
          {data.overdueActions.length === 0 ? (
            <EmptyRow>No overdue actions. Nice.</EmptyRow>
          ) : (
            <div className="flex flex-col">
              {data.overdueActions.map((action) => (
                <RowLink
                  key={action.id}
                  href={action.href}
                  title={action.title}
                  detail={action.ownerName ? `Owner: ${action.ownerName}` : "No owner yet"}
                  meta={action.daysOverdue > 0 ? `${action.daysOverdue}d overdue` : undefined}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Recently opened */}
        <Card title="Recently opened">
          {data.recentActivity.length === 0 ? (
            <EmptyRow>Your recent activity will show up here.</EmptyRow>
          ) : (
            <div className="flex flex-col">
              {data.recentActivity.map((event) =>
                event.href ? (
                  <RowLink
                    key={event.id}
                    href={event.href}
                    title={event.title}
                    detail={event.detail}
                    meta={shortWhen(event.occurredAtISO)}
                  />
                ) : (
                  <EmptyRow key={event.id}>{event.title}</EmptyRow>
                )
              )}
            </div>
          )}
        </Card>
      </div>

      {/* My workflow queue — steps assigned to me + workflows I own. */}
      <section className="mt-4">
        <MyWorkflowQueueCard userId={userId} />
      </section>

      {/* Browse all — every section is one click away. */}
      <section className="mt-6">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Browse all</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface p-3.5 no-underline shadow-card transition-colors hover:border-brand-400"
            >
              <span className="text-[14px] font-semibold text-ink">
                <span aria-hidden className="mr-1.5">
                  {section.icon}
                </span>
                {section.label}
              </span>
              <span className="text-[12px] text-ink-muted">{section.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
