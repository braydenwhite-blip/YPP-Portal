import { prisma } from "@/lib/prisma";
import { deriveClassNextAction } from "@/lib/class-next-action";
import { deriveAdvisingLifecycle } from "@/lib/advising/relationship";
import { instructorApplicationVisibilityWhere } from "@/lib/applications/application-visibility";
import { isActionTrackerEnabled, isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  getActionItemById,
  getActionsForChapter,
  getActionsForEntity,
  getActionsForMeeting,
  getMyActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { loadChapterMeetingContext } from "@/lib/chapters/meeting-context";
import { loadMentorshipSnapshot } from "@/lib/data-360/mentorship-analytics";
import {
  getMeetingById,
  getMeetingsForChapter,
  getMeetingsForEntity,
  mapMeetingToCardDTO,
  mapMeetingsToCardDTOs,
  type MeetingCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import { getMeetingActionLinks } from "@/lib/people-strategy/action-queries";
import {
  toActionLite,
  toDecisionLite,
  toMeetingLite,
} from "@/lib/people-strategy/operational-digest";
import { loadDigestInputs } from "@/lib/people-strategy/operational-digest-queries";
import { loadPublicProfile } from "@/lib/people-strategy/public-profile";
import {
  INITIATIVE_MOMENTUM_META,
  INITIATIVE_RISK_META,
} from "@/lib/people-strategy/strategic-initiative-health";
import {
  classifyInitiativeWork,
  deriveInitiativeSummary,
} from "@/lib/people-strategy/strategic-initiative-summary";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import {
  buildMentorshipPanel,
  buildPersonTimeline,
  entityInitials,
  meetingOutcomeLine,
  nextStepFromWork,
  personFootnote,
  tenureLabel,
  type Entity360,
  type Entity360MentorshipPanel,
  type MentorshipPairingInput,
  type Entity360Glance,
  type Entity360MeetingRef,
  type Entity360Signal,
  type Entity360Status,
  type Entity360Tone,
  type Entity360Type,
} from "./entity-360";
import { getWorkflowContextForActionItems } from "@/lib/workflow-engine/card-data";

import { APPLICANT_STUCK_DAYS, MENTORSHIP_QUIET_DAYS } from "./attention";
import { loadEntity360Workflows } from "./entity-360-workflows";
import {
  deriveMentorshipAttention,
  mergeMentorshipActionFacts,
  summarizeMentorshipActionFacts,
  type MentorshipCheckInFact,
} from "@/lib/mentorship/attention";
import {
  deriveClassReadiness,
  derivePartnerHealth,
  derivePersonProfileCompleteness,
  latestActivityISO,
  recencyLabel,
} from "./signals";
import { buildUnifiedTimeline } from "./timeline";
import {
  buildUnifiedWorkItems,
  workItemFromAction,
  workItemFromFollowUp,
  type WorkItem,
} from "./work-items";

/**
 * Data 360 — the per-type Entity 360 loaders.
 *
 * One dispatch (`loadEntity360`) backs the universal drawer API. Each loader
 * assembles the SAME serializable {@link Entity360} shape from the existing
 * query helpers (`getActionsForEntity`, `getMeetingsForEntity`, the digest
 * lite mappers, `loadPublicProfile`, the initiative summary engine), so the
 * drawer never invents its own meaning of "overdue" or "health".
 *
 * Access model (stricter reading wins, mirroring the rest of the tracker):
 *   - person  → any signed-in member (the public-profile gating applies; the
 *               work/meeting sections are additionally officer-gated).
 *   - action  → anyone `canViewAction` allows.
 *   - class / partner / initiative / meeting → officer-tier and above only
 *               (these are operations surfaces). Loaders return null otherwise
 *               and the API responds 404, never leaking existence.
 */

const OFFICER_FOOTNOTE = "Operations data · visible to officers and leadership";

const DRAWER_LIMITS = {
  workItems: 12,
  meetings: 8,
  classes: 8,
  timeline: 20,
} as const;

function canOpenAdminRecord(viewer: ActionViewer): boolean {
  return viewer.primaryRole === "ADMIN" || (viewer.roles ?? []).includes("ADMIN");
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function liteWorkItems(actions: ActionItemWithRelations[], now: Date): WorkItem[] {
  return actions
    .map((a) => toActionLite(a, now))
    .filter((a) => a.status !== "DROPPED")
    .map(workItemFromAction);
}

function meetingRef(dto: MeetingCardDTO): Entity360MeetingRef {
  return {
    id: dto.id,
    title: dto.title,
    dateISO: dto.startISO,
    categoryLabel: dto.categoryLabel,
    outcome: meetingOutcomeLine({
      decisionCount: dto.decisionCount,
      linkedActionCount: dto.linkedActionCount,
      openFollowUps: dto.openFollowUps,
    }),
    upcoming: dto.effectiveStatus === "upcoming" || dto.effectiveStatus === "today",
  };
}

// --- person ---------------------------------------------------------------------

async function loadPerson360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  const profile = await loadPublicProfile(id, viewer);
  if (!profile) return null;
  const officer = isOfficerTier(viewer);

  const [extra, actions, meetings, latestReview] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        createdAt: true,
        primaryRole: true,
        roles: { select: { role: true } },
        profile: { select: { grade: true } },
        menteePairs: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            startDate: true,
            cycleStage: true,
            kickoffCompletedAt: true,
            mentor: { select: { id: true, name: true, email: true } },
            actionItems: {
              where: { status: { not: "COMPLETE" } },
              select: {
                id: true,
                title: true,
                status: true,
                dueAt: true,
                completedAt: true,
                linkedActionId: true,
                sessionId: true,
              },
            },
            sessions: {
              where: { completedAt: null, cancelledAt: null, scheduledAt: { gte: now } },
              orderBy: { scheduledAt: "asc" },
              take: 1,
              select: { scheduledAt: true },
            },
          },
        },
        mentorPairs: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            startDate: true,
            cycleStage: true,
            kickoffCompletedAt: true,
            mentee: { select: { id: true, name: true, email: true } },
            actionItems: {
              where: { status: { not: "COMPLETE" } },
              select: {
                id: true,
                title: true,
                status: true,
                dueAt: true,
                completedAt: true,
                linkedActionId: true,
                sessionId: true,
              },
            },
            sessions: {
              where: { completedAt: null, cancelledAt: null, scheduledAt: { gte: now } },
              orderBy: { scheduledAt: "asc" },
              take: 1,
              select: { scheduledAt: true },
            },
          },
        },
        classOfferingsInstructed: {
          orderBy: { startDate: "desc" },
          take: DRAWER_LIMITS.classes,
          select: {
            id: true,
            title: true,
            startDate: true,
            semester: true,
            status: true,
            chapter: { select: { name: true } },
            partner: { select: { name: true } },
            _count: { select: { enrollments: true } },
          },
        },
        leadershipContributions: {
          where: { endDate: null },
          orderBy: { startDate: "desc" },
          take: 8,
          select: { id: true, title: true, startDate: true },
        },
        // Advising relationships (Leadership Roles system): who advises this
        // person, and who they advise. Names are member-visible; check-in
        // state (last/next/overdue) is an officer-facing read surfaced in the
        // facts/risks below per the advisor visibility matrix (plan §12).
        adviseeAssignments: {
          where: { isActive: true },
          select: {
            id: true,
            lastCheckInAt: true,
            nextCheckInDueAt: true,
            needsFollowUp: true,
            advisor: { select: { id: true, name: true, email: true, title: true } },
            recommendations: {
              where: { status: { in: ["SUGGESTED", "IN_PROGRESS"] } },
              orderBy: { createdAt: "desc" },
              select: { id: true, title: true, kind: true, createdAt: true },
            },
          },
        },
        advisorAssignments: {
          where: { isActive: true },
          select: {
            id: true,
            advisingStatus: true,
            needsFollowUp: true,
            followUpNote: true,
            lastCheckInAt: true,
            nextCheckInDueAt: true,
            startDate: true,
            student: { select: { id: true, name: true, email: true, title: true } },
          },
        },
      },
    }),
    getMyActionItems(id, viewer).catch(() => [] as ActionItemWithRelations[]),
    officer && isActionTrackerEnabled()
      ? prisma.meeting.findMany({
          where: {
            OR: [{ facilitatorId: id }, { attendees: { some: { userId: id } } }],
          },
          orderBy: { scheduledAt: "desc" },
          take: DRAWER_LIMITS.meetings,
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            status: true,
            _count: { select: { decisions: true } },
            followUps: {
              where: { status: { not: "COMPLETED" } },
              select: { id: true },
            },
          },
        })
      : Promise.resolve([]),
    // Latest quarterly review (officer read) — instructor/staff records show
    // "last review" as a concrete fact, never a bare performance label (§19).
    officer
      ? prisma.quarterlyReview
          .findFirst({
            where: { userId: id },
            orderBy: { createdAt: "desc" },
            select: { quarter: true, createdAt: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  if (!extra) return null;

  const roleSet = new Set<string>([
    ...(extra.primaryRole ? [extra.primaryRole] : []),
    ...extra.roles.map((r) => r.role),
  ]);
  const isStudent = roleSet.has("STUDENT");
  const isInstructorTier =
    roleSet.has("INSTRUCTOR") || roleSet.has("STAFF") || roleSet.has("CHAPTER_PRESIDENT");

  const actionLites = actions.map((a) => toActionLite(a, now));
  const openLites = actionLites.filter(
    (a) => a.status !== "DROPPED" && a.status !== "COMPLETE"
  );
  const openWork = openLites
    .map(workItemFromAction)
    .slice(0, DRAWER_LIMITS.workItems);
  const completedActions = actionLites
    .filter((a) => a.status === "COMPLETE" && a.completedISO)
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      title: a.title,
      completedAt: a.completedISO as string,
      href: a.href,
    }));
  const overdueCount = openLites.filter((a) => a.overdue).length;
  const lastActivity = latestActivityISO([
    completedActions[0]?.completedAt,
    meetings[0]?.scheduledAt,
    extra.classOfferingsInstructed[0]?.startDate,
  ]);
  const glance: Entity360Glance[] = [
    { label: "Open work", value: String(openLites.length) },
    ...(overdueCount > 0
      ? [{ label: "Overdue", value: String(overdueCount), tone: "overdue" as const }]
      : []),
    { label: "Classes", value: String(extra.classOfferingsInstructed.length) },
    ...(officer ? [{ label: "Meetings", value: String(meetings.length) }] : []),
    { label: "Mentees", value: String(profile.mentees.length) },
    { label: "Last activity", value: recencyLabel(lastActivity, now) },
  ];

  const facts: Entity360["facts"] = [];
  facts.push({ label: "Email", value: profile.email, href: `mailto:${profile.email}` });
  if (profile.phone) facts.push({ label: "Phone", value: profile.phone });
  if (profile.school) facts.push({ label: "School", value: profile.school });
  if (extra.profile?.grade) {
    facts.push({ label: "Grade", value: `Grade ${extra.profile.grade}` });
  }
  if (profile.location) facts.push({ label: "Location", value: profile.location });
  if (profile.chapterName) facts.push({ label: "Chapter", value: profile.chapterName });
  const completeness = derivePersonProfileCompleteness({
    hasBio: Boolean(profile.bio),
    hasAvatar: Boolean(profile.avatarUrl),
    hasPhone: Boolean(profile.phone),
    hasSchool: Boolean(profile.school),
    hasLocation: Boolean(profile.location),
    hasChapter: Boolean(profile.chapterName),
  });
  if (completeness.percent < 100) {
    facts.push({
      label: "Profile",
      value: `${completeness.percent}% complete · missing ${completeness.missing.join(", ")}`,
    });
  }

  // Advisor centrality (plan §12): for students, the advisor relationship and
  // its check-in state are always-visible officer facts — concrete dates and
  // flags, never a "health" label.
  const risks: string[] = [];
  if (officer && isStudent) {
    const advising = extra.adviseeAssignments[0];
    if (!advising) {
      risks.push("No advisor assigned");
    } else {
      facts.push({
        label: "Advisor",
        value: advising.advisor.name ?? advising.advisor.email,
      });
      facts.push({
        label: "Last check-in",
        value: advising.lastCheckInAt ? fmtDate(advising.lastCheckInAt) : "Never",
      });
      if (advising.nextCheckInDueAt) {
        facts.push({ label: "Next check-in", value: fmtDate(advising.nextCheckInDueAt) });
        if (advising.nextCheckInDueAt.getTime() < now.getTime()) {
          risks.push(`Advisor check-in overdue (due ${fmtDate(advising.nextCheckInDueAt)})`);
        }
      }
      if (advising.needsFollowUp) {
        risks.push("Advisor flagged this student for follow-up");
      }
      // Open recommendations are commitments to the student — keep them visible.
      for (const rec of advising.recommendations.slice(0, 3)) {
        facts.push({
          label: "Open recommendation",
          value: `${rec.title} (${prettyEnum(rec.kind)})`,
        });
      }
      if (advising.recommendations.length > 3) {
        facts.push({
          label: "Open recommendation",
          value: `+${advising.recommendations.length - 3} more`,
        });
      }
    }
  }

  // Instructor leadership centrality (plan §11): last review as a concrete
  // fact for instructor-tier records on the officer view.
  if (officer && isInstructorTier) {
    facts.push({
      label: "Last review",
      value: latestReview
        ? `${latestReview.quarter} · ${fmtDate(latestReview.createdAt)}`
        : "None on record",
    });
  }

  const people: Entity360["people"] = [
    ...profile.mentors.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      relationship: "Mentor",
    })),
    ...profile.mentees.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      relationship: "Mentee",
    })),
    // Advising links are an officer-facing read (mirrors the leadership pages).
    ...(officer
      ? extra.adviseeAssignments.map((a) => ({
          id: a.advisor.id,
          name: a.advisor.name ?? a.advisor.email,
          title: a.advisor.title,
          relationship: "Advisor",
        }))
      : []),
    ...(officer
      ? extra.advisorAssignments.map((a) => ({
          id: a.student.id,
          name: a.student.name ?? a.student.email,
          title: a.student.title,
          relationship: "Advisee",
        }))
      : []),
  ];

  // Advisor caseload (plan §12): when this person advises students, surface the
  // concrete caseload — count, follow-ups, kickoffs, next check-in — as a signal
  // + next step. Officer-facing; concrete facts, never a vague health score.
  let advisorSignal: Entity360Signal | null = null;
  let advisorNextStep: string | null = null;
  if (officer && extra.advisorAssignments.length > 0) {
    const lifecycles = extra.advisorAssignments.map((a) => ({
      studentName: a.student.name ?? a.student.email,
      life: deriveAdvisingLifecycle(
        {
          isActive: true,
          advisingStatus: a.advisingStatus,
          needsFollowUp: a.needsFollowUp,
          followUpNote: a.followUpNote,
          lastCheckInAt: a.lastCheckInAt,
          nextCheckInDueAt: a.nextCheckInDueAt,
          startDate: a.startDate,
        },
        now,
      ),
    }));
    const total = lifecycles.length;
    const kickoffs = lifecycles.filter((l) => l.life.lifecycle === "KICKOFF_NEEDED").length;
    const followUps = lifecycles.filter(
      (l) => l.life.lifecycle === "FOLLOW_UP_DUE" || l.life.lifecycle === "STALE",
    ).length;
    const nextDue = extra.advisorAssignments
      .map((a) => a.nextCheckInDueAt)
      .filter((d): d is Date => d != null)
      .sort((x, y) => x.getTime() - y.getTime())[0];

    glance.push({ label: "Advisees", value: String(total) });
    if (followUps > 0) glance.push({ label: "Follow-ups due", value: String(followUps), tone: "overdue" });
    if (kickoffs > 0) glance.push({ label: "Kickoffs needed", value: String(kickoffs), tone: "warning" });

    const parts = [`${total} student${total === 1 ? "" : "s"}`];
    if (followUps > 0) parts.push(`${followUps} follow-up${followUps === 1 ? "" : "s"} due`);
    if (kickoffs > 0) parts.push(`${kickoffs} kickoff${kickoffs === 1 ? "" : "s"} not scheduled`);
    if (nextDue) parts.push(`next check-in ${fmtDate(nextDue)}`);
    advisorSignal = {
      label: "Advising caseload",
      tone: followUps > 0 || kickoffs > 0 ? "warning" : "success",
      detail: parts.join(" · "),
    };

    const first =
      lifecycles.find((l) => l.life.lifecycle === "KICKOFF_NEEDED") ??
      lifecycles.find((l) => l.life.lifecycle === "FOLLOW_UP_DUE" || l.life.lifecycle === "STALE");
    if (first) {
      advisorNextStep =
        first.life.lifecycle === "KICKOFF_NEEDED"
          ? `Schedule kickoff with ${first.studentName}`
          : `Follow up with ${first.studentName}`;
    }
  }

  const timeline = buildPersonTimeline(
    {
      joinedAt: extra.createdAt,
      mentors: extra.menteePairs.map((p) => ({
        id: p.id,
        name: p.mentor.name ?? p.mentor.email,
        startedAt: p.startDate,
      })),
      mentees: extra.mentorPairs.map((p) => ({
        id: p.id,
        name: p.mentee.name ?? p.mentee.email,
        startedAt: p.startDate,
      })),
      classesTaught: extra.classOfferingsInstructed.map((c) => ({
        id: c.id,
        title: c.title,
        startedAt: c.startDate,
      })),
      completedActions,
      // Leadership roles are an officer-facing read; peers see the public story.
      roles: officer
        ? extra.leadershipContributions.map((r) => ({
            id: r.id,
            title: r.title,
            startedAt: r.startDate,
          }))
        : [],
    },
    { limit: DRAWER_LIMITS.timeline }
  );

  // Mentorship panel: the person's active pairings, read through the ONE
  // canonical derivation (lib/mentorship/attention). Open next-step counts come
  // from canonical `ActionItem`s plus any unlinked legacy rows (never the legacy
  // table alone, never double-counting a bridged row), and the attention reason
  // is the same concrete headline every other mentorship surface shows.
  // Officer-gated — the operational cycle read is leadership-facing.
  let mentorshipPanel: Entity360MentorshipPanel | null = null;
  if (officer) {
    const pairs = [
      ...extra.menteePairs.map((p) => ({ ...p, role: "mentee" as const, partner: p.mentor })),
      ...extra.mentorPairs.map((p) => ({ ...p, role: "mentor" as const, partner: p.mentee })),
    ];
    const pairIds = pairs.map((p) => p.id);

    const [canonicalActions, checkInRows] = pairIds.length
      ? await Promise.all([
          prisma.actionItem.findMany({
            where: {
              relatedEntityType: "MENTORSHIP",
              relatedEntityId: { in: pairIds },
              status: { notIn: ["COMPLETE", "DROPPED"] },
            },
            select: {
              id: true,
              title: true,
              status: true,
              deadlineStart: true,
              deadlineEnd: true,
              relatedEntityId: true,
              mentorshipSessionId: true,
            },
          }),
          prisma.mentorshipSession.findMany({
            where: { mentorshipId: { in: pairIds }, cancelledAt: null },
            select: {
              id: true,
              mentorshipId: true,
              scheduledAt: true,
              completedAt: true,
              cancelledAt: true,
            },
          }),
        ])
      : [[], []];

    const canonicalByMentorship = new Map<string, typeof canonicalActions>();
    for (const action of canonicalActions) {
      if (!action.relatedEntityId) continue;
      const list = canonicalByMentorship.get(action.relatedEntityId) ?? [];
      list.push(action);
      canonicalByMentorship.set(action.relatedEntityId, list);
    }
    const checkInsByMentorship = new Map<string, MentorshipCheckInFact[]>();
    for (const session of checkInRows) {
      if (!session.mentorshipId) continue;
      const list = checkInsByMentorship.get(session.mentorshipId) ?? [];
      list.push({
        id: session.id,
        scheduledAt: session.scheduledAt,
        completedAt: session.completedAt,
        cancelledAt: session.cancelledAt,
      });
      checkInsByMentorship.set(session.mentorshipId, list);
    }

    const pairings: MentorshipPairingInput[] = pairs.map((p) => {
      const openActions = mergeMentorshipActionFacts(
        canonicalByMentorship.get(p.id) ?? [],
        p.actionItems
      );
      const checkIns = checkInsByMentorship.get(p.id) ?? [];
      const cycleStage = String(p.cycleStage);
      const reviewDue =
        cycleStage === "REFLECTION_SUBMITTED" || cycleStage === "CHANGES_REQUESTED"
          ? ({ kind: "REVIEW" as const, dueAt: null })
          : null;
      const partnerName = p.partner.name ?? p.partner.email;
      const attention = deriveMentorshipAttention(
        {
          mentorshipId: p.id,
          menteeId: p.role === "mentee" ? id : p.partner.id,
          menteeName: p.role === "mentee" ? "" : partnerName,
          mentorName: p.role === "mentee" ? partnerName : "",
          status: "ACTIVE",
          openActions,
          checkIns,
          reviewDue,
          workspaceHref: `/admin/mentorship/relationships/${p.id}`,
        },
        now
      );
      const summary = summarizeMentorshipActionFacts(openActions, now);
      const lastCheckIn = checkIns
        .filter((c) => c.completedAt)
        .sort((a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime())[0];
      return {
        id: p.id,
        role: p.role,
        partnerName,
        partnerId: p.partner.id,
        cycleStage,
        kickoffCompleted: Boolean(p.kickoffCompletedAt),
        openNextSteps: summary.open,
        overdueNextSteps: summary.overdue,
        blocked: summary.blocked > 0,
        attentionReason: attention.headline,
        lastCheckInISO: lastCheckIn?.completedAt?.toISOString() ?? null,
        nextSessionISO: p.sessions[0]?.scheduledAt.toISOString() ?? null,
      };
    });
    mentorshipPanel = buildMentorshipPanel(pairings);
  }

  // "Open full page": admins land on the role-specific full-360 record pages
  // (Knowledge OS V2 Phase 2B); everyone else gets the member profile. The
  // record pages gate on ADMIN themselves, so never link non-admins there.
  const viewerIsAdmin = canOpenAdminRecord(viewer);
  const pageHref =
    viewerIsAdmin && isStudent
      ? `/admin/students/${id}`
      : viewerIsAdmin && roleSet.has("INSTRUCTOR")
        ? `/admin/instructors/${id}`
        : `/people/${id}`;

  return {
    type: "person",
    id,
    title: profile.name,
    subtitle: profile.title,
    typeLabel: "Person",
    status: { label: "Active", tone: "success" },
    meta: tenureLabel(profile.monthsActive),
    initials: entityInitials(profile.name),
    avatarUrl: profile.avatarUrl,
    pageHref,
    signal: advisorSignal,
    glance,
    facts,
    people,
    classes: extra.classOfferingsInstructed.map((c) => ({
      id: c.id,
      title: c.title,
      context: [
        c.partner?.name ?? c.chapter?.name,
        c.semester,
        `${c._count.enrollments} student${c._count.enrollments === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" · "),
      status: classStatus(c.status).label,
    })),
    workItems: openWork,
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title?.trim() || "Meeting",
      dateISO: m.scheduledAt.toISOString(),
      categoryLabel: null,
      outcome: meetingOutcomeLine({
        decisionCount: m._count.decisions,
        linkedActionCount: 0,
        openFollowUps: m.followUps.length,
      }),
      upcoming: m.scheduledAt.getTime() >= now.getTime() && m.status !== "CANCELLED",
    })),
    timeline,
    nextStep: advisorNextStep ?? nextStepFromWork(openWork),
    risks,
    footnote: personFootnote(officer),
    mentorship: mentorshipPanel,
  };
}

// --- class ----------------------------------------------------------------------

const CLASS_STATUS_META: Record<string, Entity360Status> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "success" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "overdue" },
};

function classStatus(status: string): Entity360Status {
  return CLASS_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  SUGGESTED: "suggested",
  PENDING_REVIEW: "pending",
  OFFERED: "offered",
  INSTRUCTOR_CONFIRMED: "instructor confirmed",
  CHAPTER_CONFIRMED: "chapter confirmed",
  FULLY_CONFIRMED: "confirmed",
  NEEDS_TRAINING: "needs training",
  NEEDS_CURRICULUM: "needs curriculum",
  DECLINED: "declined",
  REMOVED: "removed",
  COMPLETED: "completed",
};

function classAssignmentStatusLabel(status: string): string {
  return ASSIGNMENT_STATUS_LABELS[status] ?? status.toLowerCase();
}

async function loadClass360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isOfficerTier(viewer)) return null;
  const offering = await prisma.classOffering.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      semester: true,
      startDate: true,
      endDate: true,
      meetingDays: true,
      meetingTime: true,
      deliveryMode: true,
      capacity: true,
      instructor: { select: { id: true, name: true, email: true, title: true } },
      chapter: { select: { name: true } },
      partner: { select: { id: true, name: true } },
      regularInstructorAssignments: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          role: true,
          status: true,
          instructor: { select: { id: true, name: true, email: true, title: true } },
        },
      },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });
  if (!offering) return null;

  // Instructor coverage read from the RegularInstructorAssignment lifecycle.
  const asg = offering.regularInstructorAssignments;
  const coverageLabel =
    asg.some((a) => a.status === "FULLY_CONFIRMED")
      ? "Fully covered"
      : asg.some((a) => a.status === "INSTRUCTOR_CONFIRMED")
        ? "Partner confirmation needed"
        : asg.some((a) => a.status === "CHAPTER_CONFIRMED" || a.status === "OFFERED")
          ? "Waiting on instructor"
          : asg.some((a) => a.status === "NEEDS_TRAINING" || a.status === "NEEDS_CURRICULUM")
            ? "Training needed"
            : asg.some((a) => a.status === "SUGGESTED" || a.status === "PENDING_REVIEW")
              ? "Suggested match"
              : offering.instructor
                ? "Instructor assigned"
                : "Needs instructor";
  const coverageGap =
    coverageLabel === "Needs instructor" ||
    coverageLabel === "Partner confirmation needed" ||
    coverageLabel === "Training needed";

  const [actions, meetings, nextSession, outcome, feedbackCount] = await Promise.all([
    getActionsForEntity("CLASS_OFFERING", id, viewer),
    getMeetingsForEntity("CLASS_OFFERING", id, DRAWER_LIMITS.meetings),
    prisma.classSession
      .findFirst({
        where: { offeringId: id, isCancelled: false, date: { gte: now } },
        orderBy: { date: "asc" },
        select: { date: true },
      })
      .catch(() => null),
    prisma.classOutcome
      .findUnique({ where: { offeringId: id }, select: { instructorReflectedAt: true } })
      .catch(() => null),
    prisma.classFeedback.count({ where: { offeringId: id } }).catch(() => 0),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = await mapMeetingsToCardDTOs(meetings, now);
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  // Readiness is THE shared judgment (signals.ts) — the same rule the
  // needs-attention engine uses, so the panel and the queue always agree.
  const readiness = deriveClassReadiness(
    {
      status: offering.status,
      startDate: offering.startDate,
      endDate: offering.endDate,
      hasInstructor: offering.instructor != null,
      sessionCount: offering._count.sessions,
      enrolledCount: offering._count.enrollments,
    },
    now
  );
  const overdueHere = actionLites.filter(
    (a) => a.overdue && a.status !== "COMPLETE" && a.status !== "DROPPED"
  ).length;
  const risks: string[] = [];
  if (overdueHere > 0) {
    risks.push(`${overdueHere} linked action${overdueHere === 1 ? " is" : "s are"} overdue.`);
  }
  if (coverageGap) {
    risks.push(`Instructor coverage: ${coverageLabel}.`);
  }

  const students = offering._count.enrollments;
  const openHere = actionLites.filter(
    (a) => a.status !== "COMPLETE" && a.status !== "DROPPED"
  ).length;

  // The drawer hero CTA shares the same Next-Action helper as the Classes
  // command center, so "what to do next" never disagrees across surfaces.
  const nextAction = deriveClassNextAction(
    {
      status: offering.status,
      startDate: offering.startDate,
      endDate: offering.endDate,
      hasLeadInstructor: offering.instructor != null,
      sessionCount: offering._count.sessions,
      nextSessionAt: nextSession?.date ?? null,
      enrolledCount: students,
      partnerLinked: offering.partner != null,
      partnerConfirmationNeeded: false,
      openActionCount: openHere,
      overdueActionCount: overdueHere,
      hasReflection: outcome?.instructorReflectedAt != null,
      feedbackCount,
    },
    now
  );
  const classNextStep =
    nextAction.kind === "view_class"
      ? nextStepFromWork(workItems)
      : nextAction.reason
        ? `${nextAction.label} — ${nextAction.reason}`
        : nextAction.label;
  return {
    type: "class",
    id,
    title: offering.title,
    subtitle: offering.partner?.name ?? offering.chapter?.name ?? null,
    typeLabel: "Class",
    status: classStatus(offering.status),
    meta: [offering.semester, `${students} student${students === 1 ? "" : "s"}`]
      .filter(Boolean)
      .join(" · "),
    initials: entityInitials(offering.title),
    avatarUrl: null,
    pageHref: canOpenAdminRecord(viewer) ? `/admin/classes/${id}` : null,
    signal: readiness
      ? {
          label: `Readiness: ${readiness.label}`,
          tone: readiness.tone,
          detail:
            readiness.missing.length > 0
              ? `Missing: ${readiness.missing.join(", ")}`
              : null,
        }
      : null,
    glance: [
      { label: "Sessions", value: String(offering._count.sessions) },
      { label: "Students", value: `${students} / ${offering.capacity}` },
      {
        label: "Open work",
        value: String(openHere),
        ...(overdueHere > 0 ? { tone: "overdue" as const } : {}),
      },
      { label: "Meetings", value: String(meetingDtos.length) },
    ],
    facts: [
      { label: "Dates", value: `${fmtDate(offering.startDate)} – ${fmtDate(offering.endDate)}` },
      {
        label: "Schedule",
        value: [offering.meetingDays.join("/"), offering.meetingTime].filter(Boolean).join(" · ") || "Not set",
      },
      { label: "Delivery", value: offering.deliveryMode },
      { label: "Instructor coverage", value: coverageLabel },
      ...(offering.chapter ? [{ label: "Chapter", value: offering.chapter.name }] : []),
      ...(offering.partner ? [{ label: "Partner", value: offering.partner.name }] : []),
    ],
    people: [
      ...(offering.instructor
        ? [
            {
              id: offering.instructor.id,
              name: offering.instructor.name ?? offering.instructor.email,
              title: offering.instructor.title,
              relationship: "Lead Instructor",
            },
          ]
        : []),
      ...asg
        .filter((a) => a.instructor.id !== offering.instructor?.id)
        .map((a) => ({
          id: a.instructor.id,
          name: a.instructor.name ?? a.instructor.email,
          title: a.instructor.title,
          relationship: `${a.role.replace("_", " ").toLowerCase()} · ${classAssignmentStatusLabel(a.status)}`,
        })),
    ],
    classes: [],
    workItems,
    meetings: meetingDtos.map(meetingRef),
    timeline: buildUnifiedTimeline({
      actions: actionLites,
      meetings: meetingDtos.map((dto) => toMeetingLite(dto, now)),
      decisions: [],
      now,
      daysBack: 90,
      limit: DRAWER_LIMITS.timeline,
    }),
    nextStep: classNextStep,
    risks,
    footnote: OFFICER_FOOTNOTE,
  };
}

// --- partner --------------------------------------------------------------------

async function loadPartner360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isOfficerTier(viewer)) return null;
  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      stage: true,
      priority: true,
      contactName: true,
      contactTitle: true,
      contactEmail: true,
      contactPhone: true,
      location: true,
      lastContactedAt: true,
      nextFollowUpAt: true,
      relationshipLead: { select: { id: true, name: true, email: true, title: true } },
      chapter: { select: { id: true, name: true } },
      classOfferings: {
        orderBy: { startDate: "desc" },
        take: DRAWER_LIMITS.classes,
        select: {
          id: true,
          title: true,
          semester: true,
          status: true,
          instructor: { select: { id: true } },
          regularInstructorAssignments: { select: { status: true } },
          _count: { select: { enrollments: true } },
        },
      },
      pipelineNotes: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, kind: true, body: true, createdAt: true },
      },
      // Partner relationship operations (Knowledge OS V2 models, plan §13):
      // structured contacts, open asks, and agreements with their conditions.
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 5,
        select: {
          id: true,
          name: true,
          title: true,
          email: true,
          isPrimary: true,
          userId: true,
        },
      },
      requests: {
        where: { status: { in: ["OPEN", "IN_NEGOTIATION"] } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: 6,
        select: { id: true, title: true, status: true, dueAt: true },
      },
      agreements: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          kind: true,
          status: true,
          title: true,
          conditions: { select: { status: true } },
        },
      },
    },
  });
  if (!partner) return null;

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("PARTNER", id, viewer),
    getMeetingsForEntity("PARTNER", id, DRAWER_LIMITS.meetings),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = await mapMeetingsToCardDTOs(meetings, now);
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  // Relationship health is THE shared judgment (signals.ts) — same rule as the
  // needs-attention engine, fed with this partner's live tracker counts.
  const openHere = actionLites.filter(
    (a) => a.status !== "COMPLETE" && a.status !== "DROPPED"
  );
  const health = derivePartnerHealth(
    {
      stage: partner.stage,
      nextFollowUpAt: partner.nextFollowUpAt,
      lastContactedAt: partner.lastContactedAt,
      openActions: openHere.length,
      overdueActions: openHere.filter((a) => a.overdue).length,
    },
    now
  );
  const activeStage = health != null;
  const risks = [...(health?.reasons ?? [])];
  for (const request of partner.requests) {
    if (request.dueAt && request.dueAt.getTime() < now.getTime()) {
      risks.push(`Request overdue: ${request.title}`);
    }
  }

  // Instructor coverage across the partner's classes — the operational
  // readiness read leadership cares about, not just relationship pipeline.
  const partnerCoverage = partner.classOfferings.map((c) => {
    const s = c.regularInstructorAssignments.map((a) => a.status);
    const label = s.includes("FULLY_CONFIRMED")
      ? "Fully covered"
      : s.includes("INSTRUCTOR_CONFIRMED")
        ? "Partner confirmation needed"
        : s.some((x) => x === "CHAPTER_CONFIRMED" || x === "OFFERED")
          ? "Waiting on instructor"
          : s.some((x) => x === "NEEDS_TRAINING" || x === "NEEDS_CURRICULUM")
            ? "Training needed"
            : s.some((x) => x === "SUGGESTED" || x === "PENDING_REVIEW")
              ? "Suggested match"
              : c.instructor
                ? "Instructor assigned"
                : "Needs instructor";
    const covered = label === "Fully covered" || label === "Instructor assigned";
    return { id: c.id, title: c.title, label, covered };
  });
  const coverageGaps = partnerCoverage.filter((c) => !c.covered);
  if (!partner.relationshipLead) {
    risks.push("No relationship lead — partner coverage is unowned.");
  }
  for (const gap of coverageGaps.slice(0, 4)) {
    risks.push(`${gap.title}: ${gap.label.toLowerCase()}.`);
  }

  // Relationship-operations reads (concrete, never a composite score).
  const primaryContact =
    partner.contacts.find((c) => c.isPrimary) ?? partner.contacts[0] ?? null;
  const openRequestCount = partner.requests.length;
  const signedAgreements = partner.agreements.filter((a) => a.status === "SIGNED").length;
  const pendingConditions = partner.agreements.reduce(
    (sum, a) => sum + a.conditions.filter((c) => c.status === "PENDING").length,
    0
  );

  const timeline = buildUnifiedTimeline({
    actions: actionLites,
    meetings: meetingDtos.map((dto) => toMeetingLite(dto, now)),
    decisions: [],
    now,
    daysBack: 120,
    limit: DRAWER_LIMITS.timeline,
  });
  // Pipeline notes are part of the partner's story — merge them in by date.
  const noteEvents = partner.pipelineNotes.map((n) => ({
    id: `partner-note:${n.id}`,
    kind: "note" as const,
    occurredAtISO: n.createdAt.toISOString(),
    title: n.body.length > 120 ? `${n.body.slice(0, 119).trimEnd()}…` : n.body,
    detail: n.kind !== "NOTE" ? n.kind.replaceAll("_", " ").toLowerCase() : null,
    actorName: null,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    href: null,
  }));
  const mergedTimeline = [...timeline, ...noteEvents]
    .sort(
      (a, b) =>
        new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime()
    )
    .slice(0, DRAWER_LIMITS.timeline);

  return {
    type: "partner",
    id,
    title: partner.name,
    subtitle: partner.type,
    typeLabel: "Partner",
    status: partner.stage
      ? {
          label: partner.stage.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()),
          tone: activeStage ? "info" : "neutral",
        }
      : null,
    meta: partner.lastContactedAt
      ? `Last contact ${fmtDate(partner.lastContactedAt)}`
      : null,
    initials: entityInitials(partner.name),
    avatarUrl: null,
    pageHref: canOpenAdminRecord(viewer) ? `/admin/partners/${id}` : null,
    signal: health
      ? {
          label: health.label,
          tone: health.tone,
          detail: health.reasons.length > 0 ? health.reasons.join(" · ") : null,
        }
      : null,
    glance: [
      { label: "Open work", value: String(openHere.length) },
      ...(openRequestCount > 0
        ? [
            {
              label: "Open requests",
              value: String(openRequestCount),
              tone: "warning" as const,
            },
          ]
        : []),
      { label: "Meetings", value: String(meetingDtos.length) },
      { label: "Classes", value: String(partner.classOfferings.length) },
      ...(coverageGaps.length > 0
        ? [{ label: "Coverage gaps", value: String(coverageGaps.length), tone: "warning" as const }]
        : []),
      {
        label: "Last contact",
        value: recencyLabel(
          partner.lastContactedAt ? partner.lastContactedAt.toISOString() : null,
          now
        ),
      },
    ],
    facts: [
      // Structured PartnerContact wins; the legacy contactName columns remain
      // the fallback until the backfill retires them (plan §23).
      ...(primaryContact
        ? [
            {
              label: "Primary contact",
              value: [primaryContact.name, primaryContact.title].filter(Boolean).join(" · "),
            },
            ...(primaryContact.email
              ? [
                  {
                    label: "Email",
                    value: primaryContact.email,
                    href: `mailto:${primaryContact.email}`,
                  },
                ]
              : []),
          ]
        : [
            ...(partner.contactName
              ? [
                  {
                    label: "Contact",
                    value: [partner.contactName, partner.contactTitle]
                      .filter(Boolean)
                      .join(" · "),
                  },
                ]
              : []),
            ...(partner.contactEmail
              ? [
                  {
                    label: "Email",
                    value: partner.contactEmail,
                    href: `mailto:${partner.contactEmail}`,
                  },
                ]
              : []),
          ]),
      ...(partner.contactPhone ? [{ label: "Phone", value: partner.contactPhone }] : []),
      ...(partner.location ? [{ label: "Location", value: partner.location }] : []),
      ...(partner.chapter ? [{ label: "Chapter", value: partner.chapter.name }] : []),
      ...(partner.priority ? [{ label: "Priority", value: partner.priority }] : []),
      ...(partner.nextFollowUpAt
        ? [{ label: "Next follow-up", value: fmtDate(partner.nextFollowUpAt) }]
        : []),
      ...(openRequestCount > 0
        ? [
            {
              label: "Open requests",
              value: partner.requests
                .map((r) => `${r.title}${r.dueAt ? ` (due ${fmtDate(r.dueAt)})` : ""}`)
                .join(" · "),
            },
          ]
        : []),
      ...(partner.agreements.length > 0
        ? [
            {
              label: "Agreements",
              value: [
                `${signedAgreements} signed of ${partner.agreements.length}`,
                pendingConditions > 0
                  ? `${pendingConditions} condition${pendingConditions === 1 ? "" : "s"} pending`
                  : null,
              ]
                .filter(Boolean)
                .join(" · "),
            },
          ]
        : []),
    ],
    people: [
      ...(partner.relationshipLead
        ? [
            {
              id: partner.relationshipLead.id,
              name: partner.relationshipLead.name ?? partner.relationshipLead.email,
              title: partner.relationshipLead.title,
              relationship: "Relationship lead",
            },
          ]
        : []),
      ...partner.contacts.map((c) => ({
        id: c.userId ?? null,
        name: c.name,
        title: c.title,
        relationship: c.isPrimary ? "Primary contact" : "Contact",
      })),
    ],
    classes: partner.classOfferings.map((c) => ({
      id: c.id,
      title: c.title,
      context: [
        c.semester,
        `${c._count.enrollments} student${c._count.enrollments === 1 ? "" : "s"}`,
        partnerCoverage.find((pc) => pc.id === c.id)?.label,
      ]
        .filter(Boolean)
        .join(" · "),
      status: classStatus(c.status).label,
    })),
    workItems,
    meetings: meetingDtos.map(meetingRef),
    timeline: mergedTimeline,
    nextStep:
      nextStepFromWork(workItems) ??
      (partner.nextFollowUpAt
        ? `Follow up on ${fmtDate(partner.nextFollowUpAt)}`
        : partner.requests[0]
          ? `Resolve open request: ${partner.requests[0].title}`
          : null),
    risks,
    footnote: OFFICER_FOOTNOTE,
  };
}

// --- initiative ------------------------------------------------------------------

const INITIATIVE_HEALTH_TONE: Record<string, Entity360Tone> = {
  healthy: "success",
  drifting: "info",
  at_risk: "warning",
  critical: "overdue",
  completed: "neutral",
  archived: "neutral",
};

async function loadInitiative360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isOfficerTier(viewer)) return null;
  if (!isStrategicInitiativesEnabled()) return null;
  const def = getInitiativeDef(id);
  if (!def) return null;

  const pool = await loadDigestInputs(viewer, now);
  const classified = classifyInitiativeWork(def, pool);
  const summary = deriveInitiativeSummary({
    def,
    ...classified,
    labels: pool.labels,
    now,
    limits: { timeline: 0, keyMoments: 4, recommendations: 3 },
  });

  const actionLites = classified.actions.map((a) => toActionLite(a, now, pool.labels));
  const meetingLites = classified.meetings.map((m) => toMeetingLite(m, now, pool.labels));
  const workItems = buildUnifiedWorkItems({
    actions: actionLites,
    followUps: [],
    now,
  })
    .filter((w) => !w.completedISO)
    .slice(0, DRAWER_LIMITS.workItems);

  return {
    type: "initiative",
    id,
    title: summary.title,
    subtitle: summary.description,
    typeLabel: "Initiative",
    status: {
      label: summary.health.label,
      tone: INITIATIVE_HEALTH_TONE[summary.health.level] ?? "neutral",
    },
    meta: `${summary.progress.percent}% of tracked work complete`,
    initials: entityInitials(summary.title),
    avatarUrl: null,
    pageHref: summary.href,
    // Momentum comes straight from the initiative engine — never re-derived.
    signal: {
      label: `Momentum: ${INITIATIVE_MOMENTUM_META[summary.momentum.level].label}`,
      tone: INITIATIVE_MOMENTUM_META[summary.momentum.level].tone,
      detail: summary.momentum.reasons[0] ?? null,
    },
    glance: [
      { label: "Progress", value: `${summary.progress.percent}%` },
      {
        label: "Open work",
        value: String(summary.counts.openActions),
        ...(summary.counts.overdueActions > 0 ? { tone: "overdue" as const } : {}),
      },
      { label: "Meetings", value: String(summary.counts.meetingCount) },
      {
        label: "Milestones",
        value: `${summary.counts.milestonesComplete}/${summary.counts.milestonesTotal}`,
      },
    ],
    facts: [
      { label: "Area", value: summary.areaLabel },
      { label: "Status", value: summary.statusLabel },
      { label: "Priority", value: summary.priorityLabel },
      ...(summary.owner ? [{ label: "Owner", value: summary.owner }] : []),
      ...(summary.targetDateISO
        ? [{ label: "Target", value: fmtDate(new Date(summary.targetDateISO)) }]
        : []),
      { label: "Risk", value: INITIATIVE_RISK_META[summary.risk.level].label },
    ],
    people: summary.ownership.topLeads.slice(0, 4).map((lead) => ({
      id: null,
      name: lead.name,
      title: `${lead.openActions} open action${lead.openActions === 1 ? "" : "s"}`,
      relationship: summary.owner === lead.name ? "Owner" : "Lead",
    })),
    classes: [],
    workItems,
    meetings: classified.meetings
      .slice(0, DRAWER_LIMITS.meetings)
      .map((m) => meetingRef(m)),
    timeline: buildUnifiedTimeline({
      actions: actionLites,
      meetings: meetingLites,
      decisions: classified.decisions.map(toDecisionLite),
      now,
      daysBack: 60,
      limit: DRAWER_LIMITS.timeline,
    }),
    nextStep: nextStepFromWork(workItems),
    risks: summary.risk.factors.map((f) => f.label),
    footnote: OFFICER_FOOTNOTE,
  };
}

// --- meeting --------------------------------------------------------------------

async function loadMeeting360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isOfficerTier(viewer)) return null;
  const meeting = await getMeetingById(id);
  if (!meeting) return null;
  const dto = mapMeetingToCardDTO(meeting, now, await getMeetingActionLinks(meeting.id));
  const lite = toMeetingLite(dto, now);

  // New meetings are not linked to the polymorphic entity vocabulary.
  const actions = await getActionsForMeeting(id, viewer);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const workItems: WorkItem[] = [
    ...lite.unconvertedFollowUps.map((f) => workItemFromFollowUp(f, now)),
    ...actionLites.filter((a) => a.status !== "DROPPED").map(workItemFromAction),
  ].slice(0, DRAWER_LIMITS.workItems);

  const decisionEvents = meeting.decisions.map((d) => ({
    id: `decision:${d.id}`,
    kind: "decision" as const,
    occurredAtISO: d.createdAt.toISOString(),
    title: d.decision,
    detail: "No action yet",
    actorName: d.decidedBy?.name ?? null,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    href: null,
  }));

  const risks: string[] = [];
  if (dto.overdueFollowUps > 0) {
    risks.push(`${dto.overdueFollowUps} follow-up${dto.overdueFollowUps === 1 ? " is" : "s are"} overdue.`);
  }
  if (dto.decisionCount > 0 && dto.linkedActionCount === 0) {
    risks.push("Decisions were made but no tracker action exists yet.");
  }

  const upcoming = dto.effectiveStatus === "upcoming" || dto.effectiveStatus === "today";
  return {
    type: "meeting",
    id,
    title: dto.title,
    subtitle: dto.categoryLabel,
    typeLabel: "Meeting",
    status: upcoming
      ? { label: "Upcoming", tone: "info" }
      : dto.effectiveStatus === "needs_follow_up"
        ? { label: "Needs follow-up", tone: "warning" }
        : dto.effectiveStatus === "canceled"
          ? { label: "Cancelled", tone: "neutral" }
          : { label: "Completed", tone: "success" },
    meta: fmtDate(new Date(dto.startISO)),
    initials: entityInitials(dto.title),
    avatarUrl: null,
    pageHref: `/meetings/${id}`,
    glance: [
      { label: "Decisions", value: String(dto.decisionCount) },
      {
        label: "Open follow-ups",
        value: String(dto.openFollowUps),
        ...(dto.overdueFollowUps > 0 ? { tone: "overdue" as const } : {}),
      },
      { label: "Actions created", value: String(dto.linkedActionCount) },
      { label: "Attendees", value: String(dto.attendeeCount) },
    ],
    facts: [
      { label: "Date", value: fmtDate(new Date(dto.startISO)) },
      { label: "Category", value: dto.categoryLabel },
      ...(meeting.chapter ? [{ label: "Chapter", value: meeting.chapter.name }] : []),
      ...(meeting.location ? [{ label: "Location", value: meeting.location }] : []),
      ...(dto.recurrence && dto.recurrence !== "NONE"
        ? [{ label: "Repeats", value: dto.recurrence.toLowerCase() }]
        : []),
    ],
    people: [
      ...(dto.facilitator
        ? [
            {
              id: dto.facilitator.id,
              name: dto.facilitator.name,
              title: null,
              relationship: "Facilitator",
            },
          ]
        : []),
      ...meeting.attendees
        .filter((a) => a.user.id !== dto.facilitator?.id)
        .map((a) => ({
          id: a.user.id,
          name: a.user.name,
          title: null,
          relationship: "Attendee",
        })),
    ],
    classes: [],
    workItems,
    meetings: [],
    timeline: decisionEvents.slice(0, DRAWER_LIMITS.timeline),
    nextStep:
      lite.unconvertedFollowUps[0]?.title ??
      (upcoming ? "Prepare the agenda before the meeting" : null),
    risks,
    footnote: OFFICER_FOOTNOTE,
  };
}

// --- action ---------------------------------------------------------------------

async function loadAction360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  // getActionItemById enforces canViewAction — null covers missing AND hidden.
  const item = await getActionItemById(id, viewer);
  if (!item) return null;

  const [related, workflowContexts] = await Promise.all([
    item.relatedEntityType && item.relatedEntityId
      ? loadRelatedEntitySummary(item.relatedEntityType, item.relatedEntityId)
      : Promise.resolve(null),
    // The workflow step this action realizes (any status — provenance, not a queue).
    getWorkflowContextForActionItems([id]),
  ]);
  const workflowContext = workflowContexts.get(id) ?? null;
  const labels = related
    ? new Map([[`${related.type}:${related.id}`, related]])
    : undefined;
  const lite = toActionLite(item, now, labels);
  const work = workItemFromAction(lite);

  const commentEvents = item.comments
    .slice(-8)
    .reverse()
    .map((c) => ({
      id: `comment:${c.id}`,
      kind: "note" as const,
      occurredAtISO: c.createdAt.toISOString(),
      title: c.body.length > 140 ? `${c.body.slice(0, 139).trimEnd()}…` : c.body,
      detail: c.type === "INPUT_REQUESTED" ? "Input requested" : null,
      actorName: c.author?.name ?? c.author?.email ?? null,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: null,
    }));

  return {
    type: "action",
    id,
    title: item.title,
    subtitle: item.description
      ? item.description.length > 160
        ? `${item.description.slice(0, 159).trimEnd()}…`
        : item.description
      : null,
    typeLabel: "Action",
    status: { label: work.status, tone: work.tone === "danger" ? "overdue" : work.tone },
    meta: item.department ? item.department.name : null,
    initials: entityInitials(item.title),
    avatarUrl: null,
    pageHref: `/actions/${id}`,
    facts: [
      { label: "Priority", value: item.priority },
      { label: "Due", value: fmtDate(new Date(lite.dueISO)) },
      ...(item.department ? [{ label: "Department", value: item.department.name }] : []),
      ...(lite.sourceMeetingTitle
        ? [{ label: "Source", value: `Meeting · ${lite.sourceMeetingTitle}` }]
        : workflowContext
          ? [
              {
                label: "Source",
                value: `Workflow · ${workflowContext.instanceTitle}${workflowContext.stageName ? ` (${workflowContext.stageName})` : ""}`,
                href: `/workflows/${workflowContext.instanceId}`,
              },
            ]
          : [{ label: "Source", value: "Created directly" }]),
      ...(related ? [{ label: related.typeLabel, value: related.label }] : []),
      ...(item.chapter ? [{ label: "Chapter", value: item.chapter.name }] : []),
      ...(item.successDefinition
        ? [{ label: "Done means", value: item.successDefinition }]
        : []),
    ],
    people: [
      ...(item.lead
        ? [
            {
              id: item.lead.id,
              name: item.lead.name ?? item.lead.email,
              title: item.lead.title,
              relationship: "Lead",
            },
          ]
        : []),
      ...item.assignments
        .filter((a) => a.user.id !== item.leadId)
        .map((a) => ({
          id: a.user.id,
          name: a.user.name ?? a.user.email,
          title: a.user.title,
          relationship: a.role === "EXECUTING" ? "Executing" : a.role === "INPUT" ? "Input" : "Lead",
        })),
    ],
    classes: [],
    workItems: [],
    meetings: [],
    timeline: commentEvents,
    nextStep: lite.nextStep,
    risks: item.blockedReason ? [`Blocked: ${item.blockedReason}`] : [],
    footnote: null,
  };
}

// --- mentorship -----------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

const MENTORSHIP_STATUS_META: Record<string, Entity360Status> = {
  ACTIVE: { label: "Active", tone: "success" },
  PAUSED: { label: "Paused", tone: "warning" },
  COMPLETE: { label: "Complete", tone: "neutral" },
};

/** "SUMMER_WORKSHOP" → "Summer workshop" — readable enum values for facts. */
function prettyEnum(value: string): string {
  const words = value.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function loadMentorship360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isOfficerTier(viewer)) return null;
  const pairing = await prisma.mentorship.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      type: true,
      programGroup: true,
      cycleStage: true,
      startDate: true,
      kickoffCompletedAt: true,
      mentor: { select: { id: true, name: true, email: true, title: true } },
      mentee: { select: { id: true, name: true, email: true, title: true } },
      chair: { select: { id: true, name: true, email: true, title: true } },
      _count: { select: { checkIns: true, sessions: true } },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      sessions: {
        orderBy: { scheduledAt: "desc" },
        take: 30,
        where: { cancelledAt: null },
        select: { id: true, scheduledAt: true, completedAt: true, cancelledAt: true },
      },
      // Unbridged legacy commitments — the canonical merge de-dupes converted rows.
      actionItems: {
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          completedAt: true,
          linkedActionId: true,
          sessionId: true,
        },
      },
    },
  });
  if (!pairing) return null;

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("MENTORSHIP", id, viewer),
    getMeetingsForEntity("MENTORSHIP", id, DRAWER_LIMITS.meetings),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = await mapMeetingsToCardDTOs(meetings, now);
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  const mentorName = pairing.mentor.name ?? pairing.mentor.email;
  const menteeName = pairing.mentee.name ?? pairing.mentee.email;

  // Canonical next-step derivation — the SAME merge + attention read the
  // person panel, cockpit, and queues use, so this panel can never disagree.
  const cycleStage = String(pairing.cycleStage);
  const openFacts = mergeMentorshipActionFacts(
    actions.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      deadlineStart: a.deadlineStart,
      deadlineEnd: a.deadlineEnd,
      mentorshipSessionId: a.mentorshipSessionId,
    })),
    pairing.actionItems
  );
  const openSummary = summarizeMentorshipActionFacts(openFacts, now);
  const checkInFacts: MentorshipCheckInFact[] = pairing.sessions.map((s) => ({
    id: s.id,
    scheduledAt: s.scheduledAt,
    completedAt: s.completedAt,
    cancelledAt: s.cancelledAt,
  }));
  const attention = deriveMentorshipAttention(
    {
      mentorshipId: pairing.id,
      menteeId: pairing.mentee.id,
      menteeName,
      mentorName,
      status: pairing.status,
      openActions: openFacts,
      checkIns: checkInFacts,
      reviewDue:
        cycleStage === "REFLECTION_SUBMITTED" || cycleStage === "CHANGES_REQUESTED"
          ? { kind: "REVIEW" as const, dueAt: null }
          : null,
      workspaceHref: `/admin/mentorship/relationships/${pairing.id}`,
    },
    now
  );

  // Last recorded activity — the exact rule the attention engine uses.
  const lastActivity = latestActivityISO([
    pairing.startDate,
    pairing.kickoffCompletedAt,
    pairing.checkIns[0]?.createdAt,
    pairing.sessions[0]?.completedAt ?? pairing.sessions[0]?.scheduledAt,
  ]);
  const quietDays = lastActivity
    ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / DAY_MS)
    : null;
  const quiet =
    pairing.status === "ACTIVE" && quietDays != null && quietDays >= MENTORSHIP_QUIET_DAYS;

  return {
    type: "mentorship",
    id,
    title: `${mentorName} → ${menteeName}`,
    subtitle: "Mentorship pairing",
    typeLabel: "Mentorship",
    status: MENTORSHIP_STATUS_META[pairing.status] ?? {
      label: pairing.status,
      tone: "neutral",
    },
    meta: `Since ${fmtDate(pairing.startDate)}`,
    initials: entityInitials(`${mentorName} ${menteeName}`),
    avatarUrl: null,
    pageHref: `/admin/mentorship/relationships/${id}`,
    // The canonical attention read leads; the coarser "quiet" sweep only shows
    // when nothing more concrete is wrong.
    signal:
      attention.state === "needs_attention"
        ? {
            label: attention.headline,
            tone: attention.severity === "critical" ? "overdue" : "warning",
            detail: attention.explanation,
          }
        : quiet
          ? {
              label: `Quiet ${quietDays} days`,
              tone: quietDays >= MENTORSHIP_QUIET_DAYS * 2 ? "overdue" : "warning",
              detail: "No check-ins, reviews, or sessions recorded recently.",
            }
          : null,
    glance: [
      { label: "Check-ins", value: String(pairing._count.checkIns) },
      { label: "Sessions", value: String(pairing._count.sessions) },
      {
        label: "Open next steps",
        value: String(openSummary.open),
        ...(openSummary.overdue > 0 || openSummary.blocked > 0
          ? { tone: "warning" as const }
          : {}),
      },
      { label: "Last activity", value: recencyLabel(lastActivity, now) },
    ],
    facts: [
      { label: "Type", value: prettyEnum(pairing.type) },
      { label: "Program", value: prettyEnum(pairing.programGroup) },
      { label: "Review cycle", value: prettyEnum(cycleStage) },
      { label: "Started", value: fmtDate(pairing.startDate) },
      {
        label: "Kickoff",
        value: pairing.kickoffCompletedAt
          ? fmtDate(pairing.kickoffCompletedAt)
          : "Not completed yet",
      },
    ],
    people: [
      {
        id: pairing.mentor.id,
        name: mentorName,
        title: pairing.mentor.title,
        relationship: "Mentor",
      },
      {
        id: pairing.mentee.id,
        name: menteeName,
        title: pairing.mentee.title,
        relationship: "Mentee",
      },
      ...(pairing.chair
        ? [
            {
              id: pairing.chair.id,
              name: pairing.chair.name ?? pairing.chair.email,
              title: pairing.chair.title,
              relationship: "Chair",
            },
          ]
        : []),
    ],
    classes: [],
    workItems,
    meetings: meetingDtos.map(meetingRef),
    timeline: buildUnifiedTimeline({
      actions: actionLites,
      meetings: meetingDtos.map((dto) => toMeetingLite(dto, now)),
      decisions: [],
      now,
      daysBack: 120,
      limit: DRAWER_LIMITS.timeline,
    }),
    nextStep:
      (attention.state === "needs_attention" ? attention.recommendedAction : null) ??
      nextStepFromWork(workItems) ??
      (quiet ? `Ask ${mentorName} for a check-in.` : null),
    risks: [
      ...(openSummary.overdue > 0
        ? [`${openSummary.overdue} next step${openSummary.overdue === 1 ? " is" : "s are"} overdue.`]
        : []),
      ...(openSummary.blocked > 0
        ? [`${openSummary.blocked} next step${openSummary.blocked === 1 ? " is" : "s are"} blocked.`]
        : []),
      ...(quiet
        ? [`No recorded activity in ${quietDays} days — the pairing may have stalled.`]
        : []),
    ],
    footnote: OFFICER_FOOTNOTE,
  };
}

// --- applicant (instructor application) --------------------------------------------

const APPLICANT_STATUS_META: Record<string, Entity360Status> = {
  SUBMITTED: { label: "Submitted", tone: "neutral" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  INFO_REQUESTED: { label: "Info requested", tone: "warning" },
  PRE_APPROVED: { label: "Pre-approved", tone: "info" },
  INTERVIEW_SCHEDULED: { label: "Interview scheduled", tone: "info" },
  INTERVIEW_COMPLETED: { label: "Interview completed", tone: "info" },
  CHAIR_REVIEW: { label: "Chair review", tone: "purple" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "overdue" },
  ON_HOLD: { label: "On hold", tone: "warning" },
};

/**
 * Deliberately conservative: pipeline status, identity basics, stage
 * milestones, and linked work only — never reviewer scores, notes, or any
 * review content. Those stay on the dedicated hiring surfaces.
 */
async function loadApplicant360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isOfficerTier(viewer)) return null;
  const visibilityWhere = await instructorApplicationVisibilityWhere(viewer.id);
  if (!visibilityWhere) return null;

  const app = await prisma.instructorApplication.findFirst({
    where: { id, AND: [visibilityWhere] },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      interviewScheduledAt: true,
      approvedAt: true,
      rejectedAt: true,
      applicationTrack: true,
      schoolName: true,
      graduationYear: true,
      city: true,
      stateProvince: true,
      preferredFirstName: true,
      lastName: true,
      legalName: true,
      applicant: {
        select: { id: true, name: true, email: true, primaryRole: true },
      },
      reviewer: { select: { id: true, name: true, email: true, title: true } },
    },
  });
  if (!app) return null;

  const composed = [app.preferredFirstName, app.lastName].filter(Boolean).join(" ").trim();
  const name =
    composed || app.legalName || app.applicant?.name || app.applicant?.email || "Applicant";

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("INSTRUCTOR_APPLICATION", id, viewer),
    getMeetingsForEntity("INSTRUCTOR_APPLICATION", id, DRAWER_LIMITS.meetings),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = await mapMeetingsToCardDTOs(meetings, now);
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  const daysInPipeline = Math.max(
    0,
    Math.floor((now.getTime() - app.createdAt.getTime()) / DAY_MS)
  );
  const idleDays = Math.max(
    0,
    Math.floor((now.getTime() - app.updatedAt.getTime()) / DAY_MS)
  );
  const decided = app.status === "APPROVED" || app.status === "REJECTED";
  const interviewUpcoming =
    app.interviewScheduledAt != null &&
    app.interviewScheduledAt.getTime() > now.getTime();
  const stuck =
    !decided && !interviewUpcoming && idleDays >= APPLICANT_STUCK_DAYS;

  // The pipeline story: stage milestones first, then linked work/meetings.
  const milestones = [
    {
      id: "applicant:submitted",
      occurredAtISO: app.createdAt.toISOString(),
      title: "Application submitted",
    },
    ...(app.interviewScheduledAt
      ? [
          {
            id: "applicant:interview",
            occurredAtISO: app.interviewScheduledAt.toISOString(),
            title: interviewUpcoming ? "Interview scheduled" : "Interview held",
          },
        ]
      : []),
    ...(app.approvedAt
      ? [
          {
            id: "applicant:approved",
            occurredAtISO: app.approvedAt.toISOString(),
            title: "Approved",
          },
        ]
      : []),
    ...(app.rejectedAt
      ? [
          {
            id: "applicant:rejected",
            occurredAtISO: app.rejectedAt.toISOString(),
            title: "Not moved forward",
          },
        ]
      : []),
  ].map((m) => ({
    ...m,
    kind: "milestone" as const,
    detail: null,
    actorName: null,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    href: null,
  }));
  const workEvents = buildUnifiedTimeline({
    actions: actionLites,
    meetings: meetingDtos.map((dto) => toMeetingLite(dto, now)),
    decisions: [],
    now,
    daysBack: 180,
  });
  const timeline = [...milestones, ...workEvents]
    .sort(
      (a, b) =>
        new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime()
    )
    .slice(0, DRAWER_LIMITS.timeline);

  // A pure applicant has no member profile to open — keep the name plain text.
  const applicantIsMember =
    app.applicant != null && app.applicant.primaryRole !== "APPLICANT";

  return {
    type: "applicant",
    id,
    title: name,
    subtitle: "Instructor application",
    typeLabel: "Applicant",
    status: APPLICANT_STATUS_META[app.status] ?? { label: app.status, tone: "neutral" },
    meta: `Applied ${fmtDate(app.createdAt)}`,
    initials: entityInitials(name),
    avatarUrl: null,
    pageHref: `/admin/instructor-applicants/${id}`,
    signal: stuck
      ? {
          label: `Waiting ${idleDays} days`,
          tone: idleDays >= APPLICANT_STUCK_DAYS * 2 ? "overdue" : "warning",
          detail: "No movement on the application — applicants this stale usually walk away.",
        }
      : null,
    glance: [
      { label: "In pipeline", value: `${daysInPipeline}d` },
      {
        label: "Since movement",
        value: `${idleDays}d`,
        ...(stuck ? { tone: "warning" as const } : {}),
      },
      {
        label: "Interview",
        value: app.interviewScheduledAt
          ? fmtDate(app.interviewScheduledAt)
          : "Not scheduled",
      },
    ],
    facts: [
      { label: "Track", value: prettyEnum(app.applicationTrack) },
      ...(app.schoolName ? [{ label: "School", value: app.schoolName }] : []),
      ...(app.graduationYear
        ? [{ label: "Graduation", value: String(app.graduationYear) }]
        : []),
      ...(app.city
        ? [
            {
              label: "Location",
              value: [app.city, app.stateProvince].filter(Boolean).join(", "),
            },
          ]
        : []),
    ],
    people: [
      ...(app.applicant
        ? [
            {
              id: applicantIsMember ? app.applicant.id : null,
              name: app.applicant.name ?? app.applicant.email,
              title: null,
              relationship: "Applicant",
            },
          ]
        : []),
      ...(app.reviewer
        ? [
            {
              id: app.reviewer.id,
              name: app.reviewer.name ?? app.reviewer.email,
              title: app.reviewer.title,
              relationship: "Reviewer",
            },
          ]
        : []),
    ],
    classes: [],
    workItems,
    meetings: meetingDtos.map(meetingRef),
    timeline,
    nextStep:
      nextStepFromWork(workItems) ??
      (stuck ? "Assign a reviewer or schedule the interview." : null),
    risks: [],
    footnote:
      "Pipeline view · review scores and notes stay on the hiring surfaces",
  };
}

// --- dispatch -------------------------------------------------------------------

/**
 * Load the 360 payload for any entity, or null when it does not exist or the
 * viewer may not see it (the API route turns null into a 404 either way).
 */
// --- chapter --------------------------------------------------------------------

/** National chapter leadership only — a CP can't pull arbitrary chapters' 360s. */
function isChapterLeadershipViewer(viewer: ActionViewer): boolean {
  const adminSubtypes = viewer.adminSubtypes ?? [];
  return (
    viewer.roles.includes("ADMIN") ||
    viewer.roles.includes("STAFF") ||
    adminSubtypes.includes("LEADERSHIP") ||
    adminSubtypes.includes("SUPER_ADMIN")
  );
}

async function loadChapter360(
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  if (!isChapterLeadershipViewer(viewer)) return null;
  const ctx = await loadChapterMeetingContext(id);
  if (!ctx) return null;

  const [meetings, actions, offerings, partners, advising] = await Promise.all([
    getMeetingsForChapter(id, DRAWER_LIMITS.meetings),
    getActionsForChapter(id, viewer),
    prisma.classOffering.findMany({
      where: { chapterId: id },
      orderBy: { startDate: "desc" },
      take: DRAWER_LIMITS.classes,
      select: {
        id: true,
        title: true,
        status: true,
        semester: true,
        instructor: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.partner.findMany({
      where: { chapterId: id, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, relationshipLead: { select: { name: true } } },
    }),
    loadMentorshipSnapshot(now, { chapterId: id }),
  ]);

  const meetingDtos = await mapMeetingsToCardDTOs(meetings, now);
  const meetingRefs = meetingDtos.map(meetingRef);
  const upcomingCount = meetingRefs.filter((m) => m.upcoming).length;

  const actionLites = actions.map((a) => toActionLite(a, now));
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);
  const timeline = buildUnifiedTimeline({
    actions: actionLites,
    meetings: meetingDtos.map((dto) => toMeetingLite(dto, now)),
    decisions: [],
    now,
    limit: DRAWER_LIMITS.timeline,
  });

  const classRefs = offerings.map((o) => ({
    id: o.id,
    title: o.title,
    context:
      [
        o.semester,
        o.instructor?.name ? `Instructor: ${o.instructor.name}` : "Needs instructor",
        `${o._count.enrollments} student${o._count.enrollments === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    status: o.status,
  }));
  const classesNeedingInstructor = offerings.filter((o) => !o.instructor).length;

  // Concrete risk lines only — every one names the underlying gap.
  const risks: string[] = [];
  if (!ctx.president) risks.push("No Chapter President assigned.");
  if (upcomingCount === 0) risks.push("No upcoming meeting scheduled.");
  if (ctx.memberCount === 0) risks.push("No members yet.");
  if (classesNeedingInstructor > 0) {
    risks.push(
      `${classesNeedingInstructor} class${classesNeedingInstructor === 1 ? "" : "es"} without an instructor.`
    );
  }
  const overdueHere = actionLites.filter(
    (a) => a.overdue && a.status !== "COMPLETE" && a.status !== "DROPPED"
  ).length;
  if (overdueHere > 0) {
    risks.push(`${overdueHere} chapter action${overdueHere === 1 ? " is" : "s are"} overdue.`);
  }
  // Advising gaps come from the same metrics Data 360 grades (target-zero only).
  for (const metric of advising.metrics) {
    if (metric.breached && metric.value > 0) {
      risks.push(`${metric.label}: ${metric.value}.`);
    }
  }

  const nextStep =
    nextStepFromWork(workItems) ??
    (upcomingCount === 0
      ? "Schedule the next chapter meeting"
      : classesNeedingInstructor > 0
        ? "Assign instructors to the uncovered classes"
        : null);

  return {
    type: "chapter",
    id,
    title: ctx.name,
    subtitle: ctx.lifecycleLabel,
    typeLabel: "Chapter",
    status: null,
    meta: `${ctx.memberCount} member${ctx.memberCount === 1 ? "" : "s"}`,
    initials: entityInitials(ctx.name),
    avatarUrl: null,
    pageHref: ctx.detailHref,
    glance: [
      { label: "Members", value: String(ctx.memberCount) },
      { label: "Classes", value: String(offerings.length) },
      { label: "Partners", value: String(partners.length) },
      {
        label: "Open actions",
        value: String(ctx.openActionCount),
        ...(ctx.openActionCount > 0 ? { tone: "warning" as const } : {}),
      },
      {
        label: "Upcoming meetings",
        value: String(upcomingCount),
        ...(upcomingCount === 0 ? { tone: "overdue" as const } : {}),
      },
    ],
    facts: [
      { label: "Lifecycle", value: ctx.lifecycleLabel },
      {
        label: "Chapter President",
        value: ctx.president?.name ?? "Unassigned",
        ...(ctx.president ? { href: `/people/${ctx.president.id}` } : {}),
      },
      ...partners.slice(0, 4).map((p) => ({
        label: "Partner",
        value: p.relationshipLead?.name ? `${p.name} · Lead: ${p.relationshipLead.name}` : p.name,
        href: `/partners/${p.id}`,
      })),
    ],
    people: ctx.president
      ? [
          {
            id: ctx.president.id,
            name: ctx.president.name,
            title: null,
            relationship: "Chapter President",
          },
        ]
      : [],
    classes: classRefs,
    workItems,
    meetings: meetingRefs,
    timeline,
    nextStep,
    risks,
    footnote: OFFICER_FOOTNOTE,
  };
}

export async function loadEntity360(
  type: Entity360Type,
  id: string,
  viewer: ActionViewer,
  options: { now?: Date } = {}
): Promise<Entity360 | null> {
  const now = options.now ?? new Date();
  const trimmed = id?.trim();
  if (!trimmed) return null;
  const entity = await loadEntity360Base(type, trimmed, viewer, now);
  if (!entity) return null;
  // Workflows are operations data. The person panel is member-visible, so the
  // officer gate lives here — once, for every type — not in each loader.
  if (isOfficerTier(viewer)) {
    entity.workflows = await loadEntity360Workflows(type, trimmed, now);
  }
  return entity;
}

function loadEntity360Base(
  type: Entity360Type,
  id: string,
  viewer: ActionViewer,
  now: Date
): Promise<Entity360 | null> {
  switch (type) {
    case "person":
      return loadPerson360(id, viewer, now);
    case "class":
      return loadClass360(id, viewer, now);
    case "partner":
      return loadPartner360(id, viewer, now);
    case "initiative":
      return loadInitiative360(id, viewer, now);
    case "meeting":
      return loadMeeting360(id, viewer, now);
    case "action":
      return loadAction360(id, viewer, now);
    case "mentorship":
      return loadMentorship360(id, viewer, now);
    case "applicant":
      return loadApplicant360(id, viewer, now);
    case "chapter":
      return loadChapter360(id, viewer, now);
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
