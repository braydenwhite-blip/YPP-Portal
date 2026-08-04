import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import { AdminMentorshipCockpit } from "@/app/(app)/admin/mentorship/_components/admin-cockpit";
import { getSession } from "@/lib/auth-supabase";
import {
  canAccessMentorshipHub,
  getInstructorMentorshipMembership,
} from "@/lib/mentorship-access";
import { getLanesForChair } from "@/lib/mentorship-chair-access";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { getMentorEngagementSnapshot } from "@/lib/mentor-overview";
import { buildMentorHomeViewModel } from "@/lib/mentorship/load";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import {
  availablePovs,
  needsMentorshipRoleChooser,
  resolvePov,
  type HubPov,
} from "@/lib/mentorship/hub-pov";
import { mentorCardNeedsAttention } from "./_components/mentor-priority-list";
import { MonthlyApprovalQueue, QuarterlyCommitteeQueue } from "./_components/approval-queues";
import { MentorHomeCalm } from "./_components/mentor-home-calm";
import { EmptyStateEditorial } from "./_components/empty-state-editorial";
import { AdminMentorshipHome } from "./_components/admin-home-calm";
import { MentorshipRoleChooser } from "./_components/role-chooser";
import { PendingFeedbackRequestsCard } from "@/components/people/pending-feedback-requests-card";
import { PeopleReviewsPage } from "@/components/people-strategy/people-reviews-page";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { prisma } from "@/lib/prisma";

/**
 * Mentorship hub — mentors, mentees, and leadership.
 *
 *   (home)  → role cards for whatever sides the viewer holds
 *   people  → Mentorship Admin Hub (officer roster)
 *   mentor  → coaching console
 *   admin   → G&R templates
 *   me      → own development workspace (/mentorship/people/[id])
 */

function povHref(pov: HubPov): string {
  return `/mentorship?view=${pov}`;
}

function spString(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const raw = sp?.[key];
  return typeof raw === "string" ? raw : undefined;
}

export default async function MentorshipPage(
  props: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;

  const isAdmin = roles.includes("ADMIN");
  const [membership, chairLanes, commandAccess, committeeMemberships, hubAllowed] =
    await Promise.all([
      getInstructorMentorshipMembership(userId),
      getLanesForChair(userId, (session.user.adminSubtypes ?? []) as string[]),
      hasMentorshipCommandAccess(session.user),
      prisma.mentorCommitteeMember.findMany({
        where: { userId },
        select: { committee: { select: { track: { select: { programGroup: true } } } } },
      }),
      canAccessMentorshipHub(userId, primaryRole ?? "", roles),
    ]);

  if (!hubAllowed) {
    redirect("/");
  }

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
  const requestedView = spString(searchParams, "view");

  // Home: card chooser — Mentor only if you have mentees, Mentee only if you
  // have a mentor. Officer-tier (Admin / Staff / CP / Hiring Chair) may see People.
  if (needsMentorshipRoleChooser(facts, requestedView)) {
    const hubViewer: ActionViewer = {
      id: userId,
      roles,
      primaryRole: primaryRole ?? null,
      adminSubtypes: (session.user.adminSubtypes ?? []) as string[],
    };
    const showPeopleCard = isPeopleDashboardEnabled() && isOfficerTier(hubViewer);

    const [asMentee, asMentor, laneChairRow, pairingChairCount, pendingForChair] =
      await Promise.all([
        prisma.mentorship.findFirst({
          where: { menteeId: userId, status: "ACTIVE" },
          orderBy: { startDate: "desc" },
          select: { mentor: { select: { name: true } } },
        }),
        prisma.mentorship.findMany({
          where: { status: "ACTIVE", mentorId: userId },
          select: { mentee: { select: { name: true } } },
          orderBy: { mentee: { name: "asc" } },
          take: 8,
        }),
        // Real Role Chair assignment only — not admin bypass.
        prisma.mentorCommitteeChair.findFirst({
          where: { userId, isActive: true },
          select: { id: true },
        }),
        prisma.mentorship.count({
          where: { chairId: userId, status: "ACTIVE" },
        }),
        prisma.mentorGoalReview.count({
          where: {
            status: "PENDING_CHAIR_APPROVAL",
            mentorship: { chairId: userId },
          },
        }),
      ]);

    const isAssignedRoleChair = Boolean(laneChairRow) || pairingChairCount > 0;

    const menteeNames = asMentor
      .map((row) => row.mentee.name)
      .filter((name): name is string => Boolean(name));

    const showMentorCard = asMentor.length > 0;
    const showMenteeCard = Boolean(asMentee);

    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2 eyebrow="Mentorship" title="Mentorship" />
        <MentorshipRoleChooser
          mentorHref={showMentorCard ? povHref("mentor") : null}
          menteeHref={showMenteeCard ? `/mentorship/people/${userId}` : null}
          peopleHref={showPeopleCard ? "/mentorship?view=people" : null}
          chairHref={isAssignedRoleChair ? "/mentorship/chair" : null}
          chairPendingCount={isAssignedRoleChair ? pendingForChair : 0}
          mentorName={asMentee?.mentor.name ?? null}
          menteeNames={menteeNames}
        />
      </div>
    );
  }

  // Mentorship Admin Hub — officer-tier roster (Admin / Staff / CP / Hiring Chair).
  if (requestedView === "people") {
    const hubViewer: ActionViewer = {
      id: userId,
      roles,
      primaryRole: primaryRole ?? null,
      adminSubtypes: (session.user.adminSubtypes ?? []) as string[],
    };
    if (!isPeopleDashboardEnabled() || !isOfficerTier(hubViewer)) {
      redirect("/mentorship");
    }

    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship"
          title="Mentorship Admin"
          subtitle="Find someone. See if they need a review or a mentor. Tap to open."
          backHref="/mentorship"
          backLabel="Mentorship"
        />
        <PendingFeedbackRequestsCard />
        <PeopleReviewsPage
          searchParams={Promise.resolve(searchParams ?? {})}
          basePath="/mentorship"
          filterParam="roster"
          embedded
          hideHeading
          personHrefBase="/mentorship/people"
        />
      </div>
    );
  }

  const pov = resolvePov(facts, requestedView);

  const header = (
    <PageHeaderV2
      eyebrow="Mentorship"
      title={pov === "mentor" ? "Your mentees" : pov === "admin" ? "G&R templates" : "Mentorship"}
      subtitle={
        pov === "mentor"
          ? "Coach them, write reviews, approve when you’re the chair."
          : pov === "admin"
            ? "Create templates and assign Current G&R."
            : undefined
      }
      backHref={pov === "admin" ? "/mentorship" : undefined}
      backLabel={pov === "admin" ? "Mentorship" : undefined}
      actions={
        pov === "mentor" && facts.isMentee ? (
          <ButtonLink href={`/mentorship/people/${userId}`} variant="secondary" size="sm">
            Your own mentorship →
          </ButtonLink>
        ) : undefined
      }
    />
  );

  // ── Admin POV — simple G&R templates (not the oversight cockpit). ─────────
  if (pov === "admin") {
    const tab = spString(searchParams, "tab");
    const advancedCockpitTabs = new Set([
      "overview",
      "needs-attention",
      "assignments",
      "capacity",
      "approvals",
      "committees",
      "analytics",
    ]);

    // Goals / templates / bare admin → simple G&R page.
    // Other tab values keep the legacy oversight cockpit for power users.
    if (tab && advancedCockpitTabs.has(tab)) {
      return (
        <div className={`${skin.portalSkin} flex flex-col gap-6`}>
          <PageHeaderV2
            eyebrow="Mentorship"
            title="Mentorship admin"
            subtitle="Program oversight."
            backHref="/mentorship?view=admin"
            backLabel="G&R templates"
          />
          <AdminMentorshipCockpit
            showLeadershipOverview={commandAccess}
            searchParams={{
              tab,
              lane: spString(searchParams, "lane"),
              who: spString(searchParams, "who"),
              menteeId: spString(searchParams, "menteeId"),
              supportRole: spString(searchParams, "supportRole"),
            }}
          />
        </div>
      );
    }

    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        {header}
        <AdminMentorshipHome />
      </div>
    );
  }

  // ── Mentee POV — retired as an in-hub view. Your own Review & G&R flow is
  // your own /people/[id] now, not a "Mentorship" destination — redirect
  // rather than render inline.
  if (pov === "me") {
    const section = spString(searchParams, "section") ?? null;
    redirect(`/mentorship/people/${userId}${section ? `?section=${section}` : ""}`);
  }

  // ── Mentor POV — the coaching console. ─────────────────────────────────────
  const [mentorBlock, engagement] = await Promise.all([
    getSimplifiedMentorKanban(),
    getMentorEngagementSnapshot(),
  ]);
  const showChairQueue = isAdmin || chairLanes.length > 0;

  const allMentorCards = mentorBlock.columns.flatMap((c) => c.cards);
  const needsYouCount = allMentorCards.filter(mentorCardNeedsAttention).length;

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
      mentorCheckInComplete: card.mentorCheckInComplete,
      overallRating: card.overallRating,
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        {showChairQueue ? <MonthlyApprovalQueue /> : null}
        <QuarterlyCommitteeQueue
          viewerId={userId}
          isAdminOrLeadership={isAdmin || commandAccess}
          chairedLanes={chairLanes}
          committeeProgramGroups={committeeProgramGroups}
        />

        <PendingFeedbackRequestsCard />
        {mentorBlock.total === 0 ? (
          <EmptyStateEditorial
            title="Ready when they arrive"
            body="Your mentees will show up here once chapter leadership pairs you. Same rubric you'll use to support them."
            link={{
              label: "See the leadership pathway",
              href: "/leadership-pathway",
            }}
          />
        ) : (
          <MentorHomeCalm vm={vm} needsYouCount={needsYouCount} />
        )}
      </div>
    </div>
  );
}
