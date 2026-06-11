import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled, isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  getActionItemById,
  getActionsForEntity,
  getActionsForMeeting,
  getMyActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { meetingCategoryLabel } from "@/lib/people-strategy/meeting-categories";
import {
  getMeetingById,
  getMeetingsForEntity,
  mapMeetingToCardDTO,
  mapMeetingToDetailDTO,
  type MeetingCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import {
  toActionLite,
  toDecisionLite,
  toMeetingLite,
} from "@/lib/people-strategy/operational-digest";
import { loadDigestInputs } from "@/lib/people-strategy/operational-digest-queries";
import { loadPublicProfile } from "@/lib/people-strategy/public-profile";
import { INITIATIVE_RISK_META } from "@/lib/people-strategy/strategic-initiative-health";
import {
  classifyInitiativeWork,
  deriveInitiativeSummary,
} from "@/lib/people-strategy/strategic-initiative-summary";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import {
  buildPersonTimeline,
  entityInitials,
  meetingOutcomeLine,
  nextStepFromWork,
  personFootnote,
  tenureLabel,
  type Entity360,
  type Entity360MeetingRef,
  type Entity360Status,
  type Entity360Tone,
  type Entity360Type,
} from "./entity-360";
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

  const [extra, actions, meetings] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        createdAt: true,
        profile: { select: { grade: true } },
        menteePairs: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            startDate: true,
            mentor: { select: { id: true, name: true, email: true } },
          },
        },
        mentorPairs: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            startDate: true,
            mentee: { select: { id: true, name: true, email: true } },
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
      },
    }),
    getMyActionItems(id, viewer).catch(() => [] as ActionItemWithRelations[]),
    officer && isActionTrackerEnabled()
      ? prisma.officerMeeting.findMany({
          where: {
            OR: [{ facilitatorId: id }, { attendees: { some: { userId: id } } }],
          },
          orderBy: { date: "desc" },
          take: DRAWER_LIMITS.meetings,
          select: {
            id: true,
            title: true,
            date: true,
            category: true,
            status: true,
            _count: { select: { decisions: true, actionItems: true } },
            followUps: {
              where: { status: { not: "COMPLETED" } },
              select: { id: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  if (!extra) return null;

  const actionLites = actions.map((a) => toActionLite(a, now));
  const openWork = actionLites
    .filter((a) => a.status !== "DROPPED" && a.status !== "COMPLETE")
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

  const facts: Entity360["facts"] = [];
  facts.push({ label: "Email", value: profile.email, href: `mailto:${profile.email}` });
  if (profile.phone) facts.push({ label: "Phone", value: profile.phone });
  if (profile.school) facts.push({ label: "School", value: profile.school });
  if (extra.profile?.grade) {
    facts.push({ label: "Grade", value: `Grade ${extra.profile.grade}` });
  }
  if (profile.location) facts.push({ label: "Location", value: profile.location });
  if (profile.chapterName) facts.push({ label: "Chapter", value: profile.chapterName });

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
  ];

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
    pageHref: `/people/${id}`,
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
      title: m.title?.trim() || "Officer Meeting",
      dateISO: m.date.toISOString(),
      categoryLabel: m.category ? meetingCategoryLabel(m.category) : null,
      outcome: meetingOutcomeLine({
        decisionCount: m._count.decisions,
        linkedActionCount: m._count.actionItems,
        openFollowUps: m.followUps.length,
      }),
      upcoming: m.date.getTime() >= now.getTime() && m.status !== "CANCELLED",
    })),
    timeline,
    nextStep: nextStepFromWork(openWork),
    risks: [],
    footnote: personFootnote(officer),
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
      _count: { select: { enrollments: true, sessions: true } },
    },
  });
  if (!offering) return null;

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("CLASS_OFFERING", id, viewer),
    getMeetingsForEntity("CLASS_OFFERING", id, DRAWER_LIMITS.meetings),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  const risks: string[] = [];
  const upcomingOrRunning =
    offering.status !== "CANCELLED" &&
    offering.status !== "COMPLETED" &&
    offering.endDate.getTime() >= now.getTime();
  if (upcomingOrRunning) {
    if (offering._count.sessions === 0) risks.push("No sessions are scheduled yet.");
    if (offering._count.enrollments === 0) risks.push("No students are enrolled yet.");
    if (offering.status === "DRAFT") risks.push("Still in draft — not visible to students.");
  }

  const students = offering._count.enrollments;
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
    pageHref: `/admin/classes/${id}`,
    facts: [
      { label: "Dates", value: `${fmtDate(offering.startDate)} – ${fmtDate(offering.endDate)}` },
      {
        label: "Schedule",
        value: [offering.meetingDays.join("/"), offering.meetingTime].filter(Boolean).join(" · ") || "Not set",
      },
      { label: "Delivery", value: offering.deliveryMode },
      { label: "Sessions", value: String(offering._count.sessions) },
      { label: "Enrollment", value: `${students} / ${offering.capacity}` },
      ...(offering.chapter ? [{ label: "Chapter", value: offering.chapter.name }] : []),
      ...(offering.partner ? [{ label: "Partner", value: offering.partner.name }] : []),
    ],
    people: offering.instructor
      ? [
          {
            id: offering.instructor.id,
            name: offering.instructor.name ?? offering.instructor.email,
            title: offering.instructor.title,
            relationship: "Lead Instructor",
          },
        ]
      : [],
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
    nextStep: nextStepFromWork(workItems),
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
      classOfferings: {
        orderBy: { startDate: "desc" },
        take: DRAWER_LIMITS.classes,
        select: {
          id: true,
          title: true,
          semester: true,
          status: true,
          _count: { select: { enrollments: true } },
        },
      },
      pipelineNotes: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, kind: true, body: true, createdAt: true },
      },
    },
  });
  if (!partner) return null;

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("PARTNER", id, viewer),
    getMeetingsForEntity("PARTNER", id, DRAWER_LIMITS.meetings),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  const risks: string[] = [];
  const activeStage =
    partner.stage != null &&
    !["NOT_STARTED", "CLOSED", "DECLINED", "ARCHIVED"].includes(partner.stage);
  if (activeStage && partner.nextFollowUpAt && partner.nextFollowUpAt.getTime() < now.getTime()) {
    risks.push(`The planned follow-up (${fmtDate(partner.nextFollowUpAt)}) never happened.`);
  } else if (activeStage && !partner.nextFollowUpAt) {
    risks.push("No next step is scheduled for this relationship.");
  }

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
    pageHref: `/admin/partners/${id}`,
    facts: [
      ...(partner.contactName
        ? [
            {
              label: "Contact",
              value: [partner.contactName, partner.contactTitle].filter(Boolean).join(" · "),
            },
          ]
        : []),
      ...(partner.contactEmail
        ? [{ label: "Email", value: partner.contactEmail, href: `mailto:${partner.contactEmail}` }]
        : []),
      ...(partner.contactPhone ? [{ label: "Phone", value: partner.contactPhone }] : []),
      ...(partner.location ? [{ label: "Location", value: partner.location }] : []),
      ...(partner.priority ? [{ label: "Priority", value: partner.priority }] : []),
      ...(partner.nextFollowUpAt
        ? [{ label: "Next follow-up", value: fmtDate(partner.nextFollowUpAt) }]
        : []),
    ],
    people: partner.relationshipLead
      ? [
          {
            id: partner.relationshipLead.id,
            name: partner.relationshipLead.name ?? partner.relationshipLead.email,
            title: partner.relationshipLead.title,
            relationship: "Relationship lead",
          },
        ]
      : [],
    classes: partner.classOfferings.map((c) => ({
      id: c.id,
      title: c.title,
      context: [
        c.semester,
        `${c._count.enrollments} student${c._count.enrollments === 1 ? "" : "s"}`,
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
      (partner.nextFollowUpAt ? `Follow up on ${fmtDate(partner.nextFollowUpAt)}` : null),
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
    meta: `${summary.progress.percent}% of tracked work complete · ${summary.counts.openActions} open action${summary.counts.openActions === 1 ? "" : "s"}`,
    initials: entityInitials(summary.title),
    avatarUrl: null,
    pageHref: summary.href,
    facts: [
      { label: "Area", value: summary.areaLabel },
      { label: "Status", value: summary.statusLabel },
      { label: "Priority", value: summary.priorityLabel },
      ...(summary.owner ? [{ label: "Owner", value: summary.owner }] : []),
      ...(summary.targetDateISO
        ? [{ label: "Target", value: fmtDate(new Date(summary.targetDateISO)) }]
        : []),
      {
        label: "Milestones",
        value: `${summary.counts.milestonesComplete} of ${summary.counts.milestonesTotal} complete`,
      },
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
  const dto = mapMeetingToDetailDTO(meeting, now);
  const lite = toMeetingLite(dto, now);

  const [actions, related] = await Promise.all([
    getActionsForMeeting(id, viewer),
    meeting.relatedEntityType && meeting.relatedEntityId
      ? loadRelatedEntitySummary(meeting.relatedEntityType, meeting.relatedEntityId)
      : Promise.resolve(null),
  ]);
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
    detail: d.linkedAction ? "Action assigned" : "No action yet",
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
    pageHref: `/actions/meetings/${id}`,
    facts: [
      { label: "Date", value: fmtDate(new Date(dto.startISO)) },
      { label: "Category", value: dto.categoryLabel },
      ...(meeting.location ? [{ label: "Location", value: meeting.location }] : []),
      ...(dto.recurrence && dto.recurrence !== "NONE"
        ? [{ label: "Repeats", value: dto.recurrence.toLowerCase() }]
        : []),
      ...(related ? [{ label: related.typeLabel, value: related.label }] : []),
      {
        label: "Output",
        value:
          meetingOutcomeLine({
            decisionCount: dto.decisionCount,
            linkedActionCount: dto.linkedActionCount,
            openFollowUps: dto.openFollowUps,
          }) ?? "No decisions or actions yet",
      },
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
      ...dto.attendees
        .filter((a) => a.id !== dto.facilitator?.id)
        .map((a) => ({
          id: a.id,
          name: a.name,
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

  const related =
    item.relatedEntityType && item.relatedEntityId
      ? await loadRelatedEntitySummary(item.relatedEntityType, item.relatedEntityId)
      : null;
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
        : [{ label: "Source", value: "Created directly" }]),
      ...(related ? [{ label: related.typeLabel, value: related.label }] : []),
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

// --- dispatch -------------------------------------------------------------------

/**
 * Load the 360 payload for any entity, or null when it does not exist or the
 * viewer may not see it (the API route turns null into a 404 either way).
 */
export async function loadEntity360(
  type: Entity360Type,
  id: string,
  viewer: ActionViewer,
  options: { now?: Date } = {}
): Promise<Entity360 | null> {
  const now = options.now ?? new Date();
  const trimmed = id?.trim();
  if (!trimmed) return null;
  switch (type) {
    case "person":
      return loadPerson360(trimmed, viewer, now);
    case "class":
      return loadClass360(trimmed, viewer, now);
    case "partner":
      return loadPartner360(trimmed, viewer, now);
    case "initiative":
      return loadInitiative360(trimmed, viewer, now);
    case "meeting":
      return loadMeeting360(trimmed, viewer, now);
    case "action":
      return loadAction360(trimmed, viewer, now);
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

