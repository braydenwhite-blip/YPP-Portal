import { prisma } from "@/lib/prisma";
import { instructorApplicationVisibilityWhere } from "@/lib/applications/application-visibility";
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
  buildPersonTimeline,
  entityInitials,
  meetingOutcomeLine,
  nextStepFromWork,
  personFootnote,
  tenureLabel,
  type Entity360,
  type Entity360Glance,
  type Entity360MeetingRef,
  type Entity360Status,
  type Entity360Tone,
  type Entity360Type,
} from "./entity-360";
import { APPLICANT_STUCK_DAYS, MENTORSHIP_QUIET_DAYS } from "./attention";
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
          },
        },
        advisorAssignments: {
          where: { isActive: true },
          select: { id: true, student: { select: { id: true, name: true, email: true, title: true } } },
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
    meetings[0]?.date,
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
    risks,
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

  const students = offering._count.enrollments;
  const openHere = actionLites.filter(
    (a) => a.status !== "COMPLETE" && a.status !== "DROPPED"
  ).length;
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
  const meetingDtos = meetings.map((m) => mapMeetingToCardDTO(m, now));
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
      ...(meeting.location ? [{ label: "Location", value: meeting.location }] : []),
      ...(dto.recurrence && dto.recurrence !== "NONE"
        ? [{ label: "Repeats", value: dto.recurrence.toLowerCase() }]
        : []),
      ...(related ? [{ label: related.typeLabel, value: related.label }] : []),
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
        take: 1,
        select: { scheduledAt: true, completedAt: true },
      },
    },
  });
  if (!pairing) return null;

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("MENTORSHIP", id, viewer),
    getMeetingsForEntity("MENTORSHIP", id, DRAWER_LIMITS.meetings),
  ]);
  const actionLites = actions.map((a) => toActionLite(a, now));
  const meetingDtos = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const workItems = liteWorkItems(actions, now).slice(0, DRAWER_LIMITS.workItems);

  const mentorName = pairing.mentor.name ?? pairing.mentor.email;
  const menteeName = pairing.mentee.name ?? pairing.mentee.email;

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
    signal: quiet
      ? {
          label: `Quiet ${quietDays} days`,
          tone: quietDays >= MENTORSHIP_QUIET_DAYS * 2 ? "overdue" : "warning",
          detail: "No check-ins, reviews, or sessions recorded recently.",
        }
      : null,
    glance: [
      { label: "Check-ins", value: String(pairing._count.checkIns) },
      { label: "Sessions", value: String(pairing._count.sessions) },
      { label: "Open work", value: String(workItems.filter((w) => !w.completedISO).length) },
      { label: "Last activity", value: recencyLabel(lastActivity, now) },
    ],
    facts: [
      { label: "Type", value: prettyEnum(pairing.type) },
      { label: "Program", value: prettyEnum(pairing.programGroup) },
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
      nextStepFromWork(workItems) ??
      (quiet ? `Ask ${mentorName} for a check-in.` : null),
    risks: quiet
      ? [`No recorded activity in ${quietDays} days — the pairing may have stalled.`]
      : [],
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
  const meetingDtos = meetings.map((m) => mapMeetingToCardDTO(m, now));
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
    case "mentorship":
      return loadMentorship360(trimmed, viewer, now);
    case "applicant":
      return loadApplicant360(trimmed, viewer, now);
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
