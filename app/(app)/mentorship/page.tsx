import Link from "next/link";
import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { AdminMentorshipCockpit } from "@/app/(app)/admin/mentorship/_components/admin-cockpit";
import { getSession } from "@/lib/auth-supabase";
import {
  canAccessMentorship,
  getInstructorMentorshipMembership,
} from "@/lib/mentorship-access";
import { getLanesForChair } from "@/lib/mentorship-chair-access";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { getMentorshipPendingActionCount } from "@/lib/mentorship-notifications";
import { getMentorEngagementSnapshot } from "@/lib/mentor-overview";
import { buildMentorHomeViewModel } from "@/lib/mentorship/load";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import { availablePovs, resolvePov, type HubPov } from "@/lib/mentorship/hub-pov";
import { mentorCardNeedsAttention } from "./_components/mentor-priority-list";
import { MonthlyApprovalQueue, QuarterlyCommitteeQueue } from "./_components/approval-queues";
import { MentorHomeCalm } from "./_components/mentor-home-calm";
import { SegmentedTabs } from "./_components/segmented-tabs";
import { EmptyStateEditorial } from "./_components/empty-state-editorial";
import { AdminMentorshipHome } from "./_components/admin-home-calm";
import { prisma } from "@/lib/prisma";

/**
 * The Mentorship Command Center — one hub, three POVs.
 *
 *   me      → "My Development": what the person being developed owes and owns.
 *   mentor  → the coaching console: who needs a check-in, a review, a kickoff.
 *   admin   → the full admin cockpit: review cycles + lifecycle lanes on the
 *             overview, plus the eight-tab oversight surface that used to
 *             live at /admin/mentorship (leadership only).
 *
 * The POV is a URL param, so every view is shareable and back-button safe.
 */

const POV_LABELS: Record<HubPov, string> = {
  me: "My development",
  mentor: "Mentor console",
  admin: "Command center",
};

function povHref(pov: HubPov): string {
  return `/mentorship?view=${pov}`;
}

export default async function MentorshipPage(
  props: {
    searchParams?: Promise<{
      view?: string;
      who?: string;
      lane?: string;
      tab?: string;
      menteeId?: string;
      supportRole?: string;
      section?: string;
      sent?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;

  if (!canAccessMentorship(primaryRole ?? "")) {
    redirect("/");
  }

  const isAdmin = roles.includes("ADMIN");
  const [membership, chairLanes, commandAccess, committeeMemberships] = await Promise.all([
    getInstructorMentorshipMembership(userId),
    getLanesForChair(userId, (session.user.adminSubtypes ?? []) as string[]),
    hasMentorshipCommandAccess(session.user),
    prisma.mentorCommitteeMember.findMany({
      where: { userId },
      select: { committee: { select: { track: { select: { programGroup: true } } } } },
    }),
  ]);
  const committeeProgramGroups = Array.from(
    new Set(committeeMemberships.map((membership) => membership.committee.track.programGroup))
  );

  const facts = {
    isMentee: membership.isMentee,
    isMentor: membership.isMentor,
    isAdmin,
    isChair: chairLanes.length > 0,
    isCommitteeMember: committeeProgramGroups.length > 0,
    hasCommandCenterAccess: commandAccess,
  };
  const povs = availablePovs(facts);
  const pov = resolvePov(facts, searchParams?.view);

  const header = (
    <PageHeaderV2
      eyebrow="Mentorship"
      title="Mentorship"
      subtitle="One place to run development — yours, your mentees', and the whole org's."
    >
      {povs.length > 1 ? (
        <SegmentedTabs
          ariaLabel="Mentorship view"
          activeId={pov}
          tabs={povs.map((p) => ({ id: p, label: POV_LABELS[p], href: povHref(p) }))}
        />
      ) : null}
    </PageHeaderV2>
  );

  // ── Admin POV — the full admin cockpit. ────────────────────────────────────
  // Available to any ADMIN (parity with the old /admin/mentorship gate) and to
  // leadership with command-center access; the leadership-only overview blocks
  // (review cycles + lifecycle lanes) stay behind commandAccess.
  if (pov === "admin") {
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        {header}
        {searchParams?.tab ? (
          <AdminMentorshipCockpit
            showLeadershipOverview={commandAccess}
            searchParams={{
              tab: searchParams.tab,
              lane: searchParams?.lane,
              who: searchParams?.who,
              menteeId: searchParams?.menteeId,
              supportRole: searchParams?.supportRole,
            }}
          />
        ) : (
          <AdminMentorshipHome viewer={session.user} />
        )}
      </div>
    );
  }

  // ── Mentee POV — retired as an in-hub view. Your own Review & G&R flow is
  // your own /people/[id] now, not a "Mentorship" destination — redirect
  // rather than render inline.
  if (pov === "me") {
    const section = typeof searchParams?.section === "string" ? searchParams.section : null;
    redirect(`/mentorship/people/${userId}${section ? `?section=${section}` : ""}`);
  }

  // ── Mentor POV — the coaching console. ─────────────────────────────────────
  const [mentorBlock, engagement, pendingActionCount] = await Promise.all([
    getSimplifiedMentorKanban(),
    getMentorEngagementSnapshot(),
    getMentorshipPendingActionCount(userId),
  ]);
  const showChairQueue = isAdmin || chairLanes.length > 0;

  const allMentorCards = mentorBlock.columns.flatMap((c) => c.cards);
  const pendingReview =
    mentorBlock.columns.find((c) => c.key === "READY_FOR_REVIEW")?.cards.length ?? 0;
  const needsKickoff = allMentorCards.filter((c) => c.kickoffPending).length;
  const needsYouCount = allMentorCards.filter(mentorCardNeedsAttention).length;

  // Render only the more urgent of the two top alerts — stacked alerts is
  // noise; one is signal.
  let urgentAlert: { tone: "blue" | "amber"; title: string; detail: string } | null = null;
  if (needsKickoff > 0) {
    urgentAlert = {
      tone: "amber",
      title: `${needsKickoff} instructor${needsKickoff !== 1 ? "s" : ""} need a kickoff meeting`,
      detail: "Schedule and mark the kickoff to unlock the monthly review cycle.",
    };
  } else if (pendingReview > 0) {
    urgentAlert = {
      tone: "blue",
      title: `${pendingReview} instructor${pendingReview !== 1 ? "s" : ""} ready for your review`,
      detail: "Their reflections have been submitted and are waiting on your feedback.",
    };
  }

  const vm = buildMentorHomeViewModel({
    viewerId: userId,
    viewerName: "You",
    isAdmin,
    cards: allMentorCards.map((card) => ({
      mentorshipId: card.mentorshipId,
      menteeId: card.menteeId,
      menteeName: card.menteeName,
      cycleStage: card.cycleStage,
      kickoffPending: card.kickoffPending,
      latestRatings: card.latestRatings,
    })),
    sessions: engagement.upcomingSessions.map((s) => ({
      id: s.id,
      menteeId: s.menteeId,
      title: s.title,
      type: s.type,
      scheduledISO: s.scheduledAt,
    })),
    now: new Date(),
  });

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      {header}

      {pendingActionCount > 0 ? (
        <Link
          href="/notifications"
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-progress-50 px-3 py-1 text-[12.5px] font-semibold text-progress-700 no-underline transition-[filter] hover:brightness-[0.97]"
        >
          {pendingActionCount} mentorship update{pendingActionCount === 1 ? "" : "s"} unread →
        </Link>
      ) : null}

      {/* The approval queues live here now — chairs and committee members see
          who needs them without a separate Review Inbox / Committee Queue
          destination. Both self-hide when empty. */}
      {showChairQueue ? <MonthlyApprovalQueue /> : null}
      <QuarterlyCommitteeQueue
        viewerId={userId}
        isAdminOrLeadership={isAdmin || commandAccess}
        chairedLanes={chairLanes}
        committeeProgramGroups={committeeProgramGroups}
      />

      {mentorBlock.total === 0 ? (
        <EmptyStateEditorial
          title="Ready when they arrive."
          body="You'll see your mentees here as soon as chapter leadership pairs you with one. In the meantime, the leadership pathway is the same rubric you'll use to support them."
          link={{
            label: "See the leadership pathway",
            href: "/leadership-pathway",
          }}
        />
      ) : (
        <div className="grid gap-6">
          {urgentAlert ? (
            <CardV2
              padding="md"
              className={
                urgentAlert.tone === "amber"
                  ? "border-l-4 border-l-warning-700"
                  : "border-l-4 border-l-brand-600"
              }
            >
              <strong className="text-[14px] text-ink">{urgentAlert.title}</strong>
              <p className="m-0 mt-1 text-[13px] text-ink-muted">{urgentAlert.detail}</p>
            </CardV2>
          ) : null}

          <MentorHomeCalm vm={vm} needsYouCount={needsYouCount} />

          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/mentorship/mentees" variant="secondary" size="sm">
              All mentees →
            </ButtonLink>
            <ButtonLink href="/mentorship/schedule" variant="secondary" size="sm">
              Schedule →
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
