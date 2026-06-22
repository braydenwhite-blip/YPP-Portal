import type { ClassOfferingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatMeetingDays } from "@/lib/class-status";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import { getMeetingsForEntity, meetingDisplayTitle } from "@/lib/people-strategy/meetings-queries";
import {
  asPartnerStage,
  isActivePartnerStage,
  PARTNER_WON_STAGES,
} from "@/lib/partners-constants";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";

const ACTIVE_CLASS: ClassOfferingStatus[] = ["PUBLISHED", "IN_PROGRESS"];
const SETUP_CLASS: ClassOfferingStatus[] = ["DRAFT"];

export type PartnerOperationsStatusTone = "success" | "warning" | "danger" | "neutral";

export type PartnerOperationsListRow = {
  id: string;
  name: string;
  chapterLabel: string | null;
  openActionCount: number;
  lead: { id: string; name: string } | null;
  classes: { total: number; active: number; inSetup: number };
  instructors: Array<{ id: string; name: string }>;
  instructorsToStaff: number;
  nextFollowUpISO: string | null;
  nextMeetingISO: string | null;
  followUpOverdue: boolean;
  statusLabel: string;
  statusTone: PartnerOperationsStatusTone;
};

export type PartnerClassCard = {
  id: string;
  title: string;
  scheduleLabel: string;
  enrollmentLabel: string;
  statusLabel: "Active" | "Setup";
  statusTone: "success" | "warning";
  instructor: { id: string; name: string } | null;
  curriculumLead: string | null;
  missingInstructor: boolean;
  href: string;
};

export type PartnerOperationsDetail = {
  id: string;
  name: string;
  chapterLabel: string | null;
  classCount: number;
  statusLabel: string;
  statusTone: PartnerOperationsStatusTone;
  notes: string | null;
  lead: { id: string; name: string } | null;
  nextMeetingISO: string | null;
  nextFollowUpISO: string | null;
  classes: PartnerClassCard[];
  openActions: Array<{
    id: string;
    title: string;
    dateRangeLabel: string;
    ownerInitials: string;
    href: string;
  }>;
  followUpHistory: Array<{ id: string; dateLabel: string; text: string }>;
  filesAndLinks: Array<{ id: string; label: string; href: string | null }>;
  partnerMeetings: Array<{ id: string; title: string; dateLabel: string; href: string }>;
};

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function shortDate(iso: string | Date | null, now = new Date()): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function scheduleLabel(offering: {
  meetingDays: string[];
  meetingTime: string;
}): string {
  const days = formatMeetingDays(offering.meetingDays);
  const time = offering.meetingTime?.trim() || "";
  if (days && time) return `${days} ${time.split("-")[0]?.trim() ?? time}`;
  return [days, time].filter(Boolean).join(" ") || "Schedule TBD";
}

export function derivePartnerStatusLabel(input: {
  stage: string | null;
  agreementsPending: number;
  followUpOverdue: boolean;
  activeClassCount: number;
}): { label: string; tone: PartnerOperationsStatusTone } {
  const stage = asPartnerStage(input.stage);
  if (
    input.followUpOverdue &&
    (PARTNER_WON_STAGES as readonly string[]).includes(stage)
  ) {
    return { label: "Renewal due", tone: "warning" };
  }
  if (
    input.agreementsPending > 0 ||
    stage === "NEGOTIATING" ||
    stage === "PROPOSAL_SENT" ||
    stage === "NEEDS_PROPOSAL"
  ) {
    return { label: "Approval pending", tone: "warning" };
  }
  if (
    stage === "ACTIVE_PARTNERSHIP" ||
    stage === "COMPLETED" ||
    input.activeClassCount > 0
  ) {
    return { label: "Active", tone: "success" };
  }
  if (isActivePartnerStage(stage)) {
    return { label: "In conversation", tone: "neutral" };
  }
  return { label: "Parked", tone: "neutral" };
}

function isClassMissingInstructor(
  status: ClassOfferingStatus,
  assignments: Array<{ status: string }>
): boolean {
  if (status === "CANCELLED" || status === "COMPLETED") return false;
  if (assignments.length === 0) return true;
  return !assignments.some((a) =>
    ["FULLY_CONFIRMED", "INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED"].includes(a.status)
  );
}

const OFFERING_SELECT = {
  id: true,
  title: true,
  status: true,
  capacity: true,
  meetingDays: true,
  meetingTime: true,
  instructor: { select: { id: true, name: true, email: true } },
  regularInstructorAssignments: {
    select: {
      status: true,
      role: true,
      instructor: { select: { id: true, name: true, email: true } },
      curriculumDraft: {
        select: {
          author: { select: { name: true, email: true } },
        },
      },
    },
  },
  _count: { select: { enrollments: true } },
} as const;

export async function loadPartnersOperationsList(): Promise<PartnerOperationsListRow[]> {
  const now = new Date();

  const partners = await prisma.partner.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      location: true,
      stage: true,
      nextFollowUpAt: true,
      meetingDate: true,
      relationshipLead: { select: { id: true, name: true, email: true } },
      agreements: { select: { conditions: { select: { status: true } } } },
      classOfferings: { select: OFFERING_SELECT },
    },
  });

  const ids = partners.map((p) => p.id);
  const [openActions, upcomingMeetings] = await Promise.all([
    countOpenActionsByRelatedEntity("PARTNER", ids),
    ids.length > 0
      ? prisma.officerMeeting.findMany({
          where: {
            relatedEntityType: "PARTNER",
            relatedEntityId: { in: ids },
            date: { gte: now },
            status: { not: "CANCELLED" },
          },
          orderBy: { date: "asc" },
          select: { relatedEntityId: true, date: true },
        })
      : Promise.resolve([]),
  ]);

  const nextMeetingByPartner = new Map<string, Date>();
  for (const m of upcomingMeetings) {
    if (m.relatedEntityId && !nextMeetingByPartner.has(m.relatedEntityId)) {
      nextMeetingByPartner.set(m.relatedEntityId, m.date);
    }
  }

  return partners.map((partner) => {
    const offerings = partner.classOfferings;
    const active = offerings.filter((o) =>
      ACTIVE_CLASS.includes(o.status as ClassOfferingStatus)
    ).length;
    const inSetup = offerings.filter((o) =>
      SETUP_CLASS.includes(o.status as ClassOfferingStatus)
    ).length;

    const instructorMap = new Map<string, { id: string; name: string }>();
    for (const o of offerings) {
      const lead = o.instructor;
      if (lead) {
        instructorMap.set(lead.id, {
          id: lead.id,
          name: lead.name || lead.email || "Instructor",
        });
      }
      for (const a of o.regularInstructorAssignments) {
        instructorMap.set(a.instructor.id, {
          id: a.instructor.id,
          name: a.instructor.name || a.instructor.email || "Instructor",
        });
      }
    }

    let instructorsToStaff = 0;
    for (const o of offerings) {
      if (isClassMissingInstructor(o.status as ClassOfferingStatus, o.regularInstructorAssignments)) {
        instructorsToStaff += 1;
      }
    }

    const followUpOverdue = Boolean(
      partner.nextFollowUpAt && partner.nextFollowUpAt.getTime() < now.getTime()
    );
    const pendingConditions = partner.agreements.reduce(
      (sum, a) => sum + a.conditions.filter((c) => c.status === "PENDING").length,
      0
    );
    const status = derivePartnerStatusLabel({
      stage: partner.stage,
      agreementsPending: pendingConditions,
      followUpOverdue,
      activeClassCount: active,
    });

    return {
      id: partner.id,
      name: partner.name,
      chapterLabel: partner.location,
      openActionCount: openActions.get(partner.id) ?? 0,
      lead: partner.relationshipLead
        ? {
            id: partner.relationshipLead.id,
            name: partner.relationshipLead.name ?? partner.relationshipLead.email ?? "Lead",
          }
        : null,
      classes: { total: offerings.length, active, inSetup },
      instructors: Array.from(instructorMap.values()).slice(0, 4),
      instructorsToStaff,
      nextFollowUpISO: partner.nextFollowUpAt?.toISOString() ?? null,
      nextMeetingISO:
        nextMeetingByPartner.get(partner.id)?.toISOString() ??
        partner.meetingDate?.toISOString() ??
        null,
      followUpOverdue,
      statusLabel: status.label,
      statusTone: status.tone,
    };
  });
}

export async function loadPartnerOperationsDetail(
  id: string,
  viewer: ActionViewer
): Promise<PartnerOperationsDetail | null> {
  const now = new Date();

  const partner = await prisma.partner.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      name: true,
      location: true,
      stage: true,
      notes: true,
      nextFollowUpAt: true,
      meetingDate: true,
      relationshipLead: { select: { id: true, name: true, email: true } },
      agreements: {
        select: {
          id: true,
          title: true,
          kind: true,
          status: true,
          conditions: { select: { status: true } },
        },
      },
      pipelineNotes: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, body: true, createdAt: true },
      },
      classOfferings: {
        orderBy: { startDate: "desc" },
        select: OFFERING_SELECT,
      },
    },
  });
  if (!partner) return null;

  const [actions, meetings] = await Promise.all([
    getActionsForEntity("PARTNER", id, viewer).catch(() => []),
    getMeetingsForEntity("PARTNER", id).catch(() => []),
  ]);

  const openActions = actions
    .filter((a) => a.status !== "COMPLETE" && a.status !== "DROPPED")
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      title: a.title,
      dateRangeLabel: [
        a.deadlineStart ? shortDate(a.deadlineStart, now) : null,
        a.deadlineEnd ? shortDate(a.deadlineEnd, now) : null,
      ]
        .filter(Boolean)
        .join(" – ") || "No dates",
      ownerInitials: initials(a.lead?.name || a.lead?.email || "Owner"),
      href: `/actions/${a.id}`,
    }));

  const upcoming = meetings
    .filter((m) => m.status !== "CANCELLED" && new Date(m.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextMeeting = upcoming[0] ?? null;

  const followUpOverdue = Boolean(
    partner.nextFollowUpAt && partner.nextFollowUpAt.getTime() < now.getTime()
  );
  const pendingConditions = partner.agreements.reduce(
    (sum, a) => sum + a.conditions.filter((c) => c.status === "PENDING").length,
    0
  );
  const activeCount = partner.classOfferings.filter((o) =>
    ACTIVE_CLASS.includes(o.status as ClassOfferingStatus)
  ).length;
  const status = derivePartnerStatusLabel({
    stage: partner.stage,
    agreementsPending: pendingConditions,
    followUpOverdue,
    activeClassCount: activeCount,
  });

  const classes: PartnerClassCard[] = partner.classOfferings.map((o) => {
    const isSetup = SETUP_CLASS.includes(o.status as ClassOfferingStatus);
    const leadAssignment = o.regularInstructorAssignments.find((a) => a.role === "LEAD");
    const instructor = o.instructor
      ? { id: o.instructor.id, name: o.instructor.name || o.instructor.email || "Instructor" }
      : leadAssignment
        ? {
            id: leadAssignment.instructor.id,
            name:
              leadAssignment.instructor.name ||
              leadAssignment.instructor.email ||
              "Instructor",
          }
        : null;
    const curriculumLead =
      leadAssignment?.curriculumDraft?.author?.name ??
      leadAssignment?.curriculumDraft?.author?.email ??
      null;
    const missing = isClassMissingInstructor(
      o.status as ClassOfferingStatus,
      o.regularInstructorAssignments
    );

    return {
      id: o.id,
      title: o.title,
      scheduleLabel: scheduleLabel(o),
      enrollmentLabel: `${o._count.enrollments} / ${o.capacity}`,
      statusLabel: isSetup ? "Setup" : "Active",
      statusTone: isSetup ? "warning" : "success",
      instructor,
      curriculumLead,
      missingInstructor: missing && isSetup,
      href: `/admin/classes/${o.id}`,
    };
  });

  return {
    id: partner.id,
    name: partner.name,
    chapterLabel: partner.location,
    classCount: partner.classOfferings.length,
    statusLabel: status.label,
    statusTone: status.tone,
    notes: partner.notes,
    lead: partner.relationshipLead
      ? {
          id: partner.relationshipLead.id,
          name: partner.relationshipLead.name ?? partner.relationshipLead.email ?? "Lead",
        }
      : null,
    nextMeetingISO: nextMeeting?.date.toISOString() ?? partner.meetingDate?.toISOString() ?? null,
    nextFollowUpISO: partner.nextFollowUpAt?.toISOString() ?? null,
    classes,
    openActions,
    followUpHistory: partner.pipelineNotes.map((n) => ({
      id: n.id,
      dateLabel: shortDate(n.createdAt, now),
      text: n.body,
    })),
    filesAndLinks: partner.agreements.map((a) => ({
      id: a.id,
      label: a.title || a.kind || "Agreement",
      href: null,
    })),
    partnerMeetings: meetings.slice(0, 8).map((m) => ({
      id: m.id,
      title: meetingDisplayTitle(m),
      dateLabel: shortDate(m.date, now),
      href: `/meetings/${m.id}`,
    })),
  };
}

export { initials, shortDate };
