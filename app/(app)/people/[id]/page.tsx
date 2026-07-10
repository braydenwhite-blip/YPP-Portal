import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { loadPublicProfile } from "@/lib/people-strategy/public-profile";
import {
  getOperationalContextForEntity,
  type EntityOperationalContext,
} from "@/lib/people-strategy/operational-context-queries";
import {
  canCreateAction,
  isLeadershipOrBoard,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { loadPersonAttention } from "@/lib/people-strategy/needs-attention-queries";
import type { AttentionItem } from "@/lib/people-strategy/needs-attention";
import { NeedsAttentionList } from "@/components/people-strategy/needs-attention-list";
import { AdvisorCaseloadCard } from "@/components/advising/advisor-caseload-card";
import { getLeadershipContext } from "@/lib/leadership-context";
import type { LeadershipStage } from "@/lib/leadership-pathway";
import { OperationalContextPanel } from "@/components/people-strategy/operational-context-panel";
import { OperationalTimeline } from "@/components/people-strategy/operational-timeline";
import { deriveOperationalTimeline } from "@/lib/people-strategy/operational-timeline";
import { deriveStrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";
import { meetingPrefillToQuery } from "@/lib/people-strategy/action-prefill";
import { StrategicEntityPanel } from "@/components/people-strategy/strategic-entity-panel";
import { LeadershipStageContext } from "@/components/people-strategy/leadership-stage-context";
import { ProfileBody, activeLabel } from "@/components/people-strategy/profile-body";
import { PersonChapterSection } from "@/components/chapters/person-chapter-section";
import { AskAboutThis } from "@/components/help-agent/ask-about-this";
import { getPersonAccessSummary } from "@/lib/org/access-summary";
import { AccessSummaryPanel } from "@/components/people-strategy/access-summary-panel";
import type { AccessFact } from "@/lib/org/access-explainer";
import { prisma } from "@/lib/prisma";
import {
  getMentorshipAssignmentHistory,
  type MentorshipHistoryEntry,
} from "@/lib/mentorship-reassign-actions";
import { MentorHistoryPanel } from "@/components/people-strategy/mentor-history-panel";
import {
  getPersonPromotionHistory,
  type PromotionHistoryEntry,
} from "@/lib/org/promotion-queries";
import { PromotionHistoryPanel } from "@/components/people-strategy/promotion-history-panel";
import { PromotePersonForm } from "@/components/people-strategy/promote-person-form";
import { INSTRUCTION_TITLES, LEADERSHIP_TITLES } from "@/lib/org/levels";

const PROMOTION_TITLE_OPTIONS = [...INSTRUCTION_TITLES, ...LEADERSHIP_TITLES];

/** Eligible primary-mentor candidates (excludes the person being viewed). */
async function loadMentorCandidates(
  excludeUserId: string
): Promise<Array<{ id: string; name: string }>> {
  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      archivedAt: null,
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 300,
  });
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Member Profile" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const fromPeopleReviews = sp.from === "people";
  const legacyMentorshipSection = typeof sp.section === "string" ? sp.section : undefined;
  const legacyMentorshipPanel = typeof sp.panel === "string" ? sp.panel : undefined;

  // Preserve old bookmarks, but keep People as a general member profile. All
  // Mentorship work belongs to the canonical Mentorship person workspace.
  if (legacyMentorshipSection || legacyMentorshipPanel) {
    const query = new URLSearchParams();
    if (legacyMentorshipSection) query.set("section", legacyMentorshipSection);
    if (legacyMentorshipPanel) query.set("panel", legacyMentorshipPanel);
    redirect(`/mentorship/people/${id}?${query.toString()}`);
  }

  // Any signed-in member may view; signed-out visitors go to login.
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?next=/people/${id}`);

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  // Returns null for missing/archived/applicant-only users → 404 (never leaks
  // existence of a non-member account).
  const profile = await loadPublicProfile(id, viewer);
  if (!profile) notFound();
  const personMeetingHref = meetingPrefillToQuery({
    relatedType: "USER",
    relatedId: id,
    area: "MENTORSHIP",
    meetingType: "MONTHLY_CHECK_IN",
    title: `Check-in: ${profile.name}`,
    purpose: `Review current work, check-ins, reviews, feedback, and next steps for ${profile.name}.`,
    agendaTitles: [
      "Current responsibilities and actions",
      "Upcoming and overdue deadlines",
      "Recent meetings and follow-ups",
      "Check-in and review status",
      "Next best action",
    ],
  });

  // People Strategy Operating System — Action Tracker items linked to this
  // person. Additive + double-flagged; an officer-only operating panel (peers
  // viewing the public profile don't get it), visibility-filtered for the viewer.
  const showLinkedActions =
    isOperationsHubEnabled() && isActionTrackerEnabled() && isOfficerTier(viewer);

  // Phase 6 connective tissue — surface where this person sits on the Leadership
  // Pathway as context next to their linked actions (the team's prescribed
  // pattern: actions link to USER, the stage is shown as context). Loaded only
  // for the officer operating view, in parallel with the linked actions.
  let opsContext: EntityOperationalContext | null = null;
  let leadershipStage: LeadershipStage | null = null;
  let leadershipNextStage: LeadershipStage | null = null;
  let personAttention: AttentionItem[] = [];
  // "Why This Person Has Access" — admin/officer-only access summary (Phase 2 of
  // docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
  let accessFacts: AccessFact[] = [];
  // Mentor history + reassign (Phase 4 surface), admin/officer-only.
  let mentorHistory: MentorshipHistoryEntry[] = [];
  let mentorCandidates: Array<{ id: string; name: string }> = [];
  // Promotion history + promote form (Phase 8 surface), admin/officer-only.
  let promotionHistory: PromotionHistoryEntry[] = [];
  let chapterOptions: Array<{ id: string; name: string }> = [];
  let committeeOptions: string[] = [];
  if (showLinkedActions) {
    const [context, leadership, attention, access, history, candidates, promotions, chapters, committeeRows] =
      await Promise.all([
        getOperationalContextForEntity("USER", id, viewer),
        getLeadershipContext(id),
        loadPersonAttention(id, viewer),
        getPersonAccessSummary(id),
        getMentorshipAssignmentHistory(id),
        loadMentorCandidates(id),
        getPersonPromotionHistory(id),
        prisma.chapter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
        prisma.committee.findMany({ where: { archivedAt: null }, select: { name: true }, orderBy: { name: "asc" } }),
      ]);
    opsContext = context;
    leadershipStage = leadership?.stage ?? null;
    leadershipNextStage = leadership?.nextStage ?? null;
    accessFacts = access ?? [];
    mentorHistory = history;
    mentorCandidates = candidates;
    promotionHistory = promotions;
    chapterOptions = chapters;
    committeeOptions = committeeRows.map((c) => c.name);
    // Person-level People Strategy signals (mentor, kickoff, check-in,
    // provisional) are Leadership/Board-confidential; a scoped officer sees only
    // this person's own work signals (overdue / blocked / stale actions).
    personAttention = isLeadershipOrBoard(viewer)
      ? attention
      : attention.filter((item) => !item.confidential);
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      {fromPeopleReviews ? (
        <Link
          href="/people"
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#6b21c8] hover:text-[#5a1da8]"
        >
          ← People &amp; Reviews
        </Link>
      ) : null}

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.3px] text-[#1c1a2e]">
            {viewer.id === id ? "My Development" : profile.name}
          </h1>
          <p className="m-0 mt-1 text-[13.5px] text-[#717189]">
            {viewer.id === id ? `${profile.name} · ` : ""}
            {profile.title}
            {profile.chapterName ? ` · ${profile.chapterName}` : ""}
            {` · ${activeLabel(profile.monthsActive)}`}
          </p>
        </div>
      </header>

      <ProfileBody profile={profile} compact={fromPeopleReviews} />

      <div className="mt-4">
        <PersonChapterSection userId={id} />
      </div>

      {showLinkedActions && opsContext && !fromPeopleReviews ? (
        <details className="group mt-4 overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-[15px] font-semibold text-[#1c1a2e]">Leadership tools</span>
            <span className="text-[12.5px] text-[#9a9ab0]">
              Accountability, access, mentor history, promotions
              <span className="ml-2 transition-transform group-open:rotate-180" aria-hidden>
                ▾
              </span>
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t border-[#f1f1f6] p-4">
          <section className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] px-4 py-4">
            <h2 className="m-0 text-[15px] font-semibold text-[#1c1a2e]">
              Needs attention
            </h2>
            <p className="m-0 mt-1 text-[13px] text-[#717189]">
              Overdue work, check-ins, and mentor gaps for {profile.name}.
            </p>
            <div className="mt-3">
            <NeedsAttentionList
              items={personAttention}
              emptyHint={`Nothing needs attention for ${profile.name} right now.`}
            />
            </div>
          </section>
          {/* Advising caseload — self-hides when this person advises no
              students, so it only appears for people acting as advisors. */}
          <AdvisorCaseloadCard advisorId={id} />
          <LeadershipStageContext stage={leadershipStage} nextStage={leadershipNextStage} />
          <AccessSummaryPanel personName={profile.name} facts={accessFacts} />
          <MentorHistoryPanel personName={profile.name} entries={mentorHistory} />
          <PromotionHistoryPanel personName={profile.name} entries={promotionHistory} />
          <PromotePersonForm
            userId={id}
            canonicalTitles={PROMOTION_TITLE_OPTIONS}
            chapters={chapterOptions}
            mentors={mentorCandidates}
            committees={committeeOptions}
          />
          <OperationalContextPanel
            title="Accountability"
            subtitle={`Meetings & actions for ${profile.name}`}
            health={opsContext.health}
            meetings={opsContext.meetings}
            actions={opsContext.actions}
            openFollowUps={opsContext.openFollowUps}
            recentDecisions={opsContext.recentDecisions}
            canCreate={canCreateAction(viewer)}
            createActionHref={`/actions/new?relatedType=USER&relatedId=${id}`}
            createMeetingHref={personMeetingHref}
            emptyActionsHint="No Action Tracker items are linked to this person yet."
            emptyMeetingsHint="This person hasn't been the focus of a tracked meeting yet."
          />
          {isStrategicInitiativesEnabled() ? (
            <StrategicEntityPanel
              context={deriveStrategicEntityContext({
                actions: opsContext.actions,
                meetings: opsContext.meetings,
              })}
              title="Role in strategy"
            />
          ) : null}
          <OperationalTimeline
            events={deriveOperationalTimeline({
              meetings: opsContext.meetings,
              actions: opsContext.actions,
              decisions: opsContext.recentDecisions,
              followUps: opsContext.openFollowUps,
            })}
            compact
            createActionHref={`/actions/new?relatedType=USER&relatedId=${id}`}
            createMeetingHref={personMeetingHref}
          />
          <AskAboutThis entityType="person" entityId={id} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
