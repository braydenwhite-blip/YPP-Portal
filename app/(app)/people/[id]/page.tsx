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
import { ReassignMentorForm } from "@/components/people-strategy/reassign-mentor-form";
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
      primaryRole: { in: ["MENTOR", "INSTRUCTOR", "STAFF", "ADMIN", "CHAPTER_PRESIDENT"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 300,
  });
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Member Profile" };

type PageProps = { params: Promise<{ id: string }> };

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;

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
    <div className="page-shell" style={{ maxWidth: 880 }}>
      <p className="badge">Member Profile</p>

      {/* Identity header */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          padding: "20px 22px",
          margin: "8px 0 14px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "var(--ps-accent-soft)",
            color: "var(--ps-accent)",
            border: "1px solid var(--ps-border)",
            fontSize: 22,
            fontWeight: 800,
            flex: "0 0 auto",
          }}
          aria-hidden
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- existing avatar pattern.
            <img
              src={profile.avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials(profile.name)
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {profile.name}
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {profile.title}
            {profile.chapterName ? ` · ${profile.chapterName}` : ""}
            {` · ${activeLabel(profile.monthsActive)}`}
          </p>
        </div>
        {showLinkedActions ? (
          <div style={{ marginLeft: "auto" }}>
            <AskAboutThis entityType="person" entityId={id} />
          </div>
        ) : null}
      </div>

      <ProfileBody profile={profile} />

      {showLinkedActions && opsContext ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <section className="card" style={{ padding: "16px 18px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
              Needs attention for {profile.name}
            </h2>
            <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
              Overdue or blocked work, mentor & kickoff coverage, check-ins, and
              provisional confirmation — what to act on first.
            </p>
            <NeedsAttentionList
              items={personAttention}
              emptyHint={`Nothing needs attention for ${profile.name} right now.`}
            />
          </section>
          <LeadershipStageContext stage={leadershipStage} nextStage={leadershipNextStage} />
          <AccessSummaryPanel personName={profile.name} facts={accessFacts} />
          <MentorHistoryPanel personName={profile.name} entries={mentorHistory} />
          <ReassignMentorForm menteeId={id} candidates={mentorCandidates} />
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
        </div>
      ) : null}
    </div>
  );
}
