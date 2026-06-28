import "server-only";

import { loadChapterOperatingSystem } from "@/lib/chapters/operating-system";
import {
  partnerFollowUp,
  partnerPlaybookStatus,
  PARTNER_PLAYBOOK_STATUS_LABELS,
  summarizePartnerPipeline,
  type PartnerRecord,
} from "@/lib/chapters/pipeline";
import type { ImpactMeetingPrep } from "@/lib/chapters/impact-meeting";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import type { SessionUser } from "@/lib/authorization-roles";

export type MeetingAlert = {
  severity: "critical" | "warning";
  title: string;
  href: string;
};

export type MeetingsCommandCenter = {
  chapterName: string | null;
  chapterHref: string | null;
  impact: ImpactMeetingPrep | null;
  partnerPipeline: {
    total: number;
    followUpNeeded: number;
    meetingScheduled: number;
    confirmed: number;
    byStatus: Array<{ status: string; label: string; count: number }>;
  } | null;
  instructorPipeline: {
    applicants: number;
    hired: number;
    interviewsScheduled: number;
    waitingForReview: number;
  } | null;
  alerts: MeetingAlert[];
  partnersNeedingFollowUp: Array<{ id: string; name: string; reason: string; href: string }>;
  meetingsNeedingWorkspace: Array<{
    id: string;
    title: string;
    missing: string[];
    href: string;
  }>;
  operational: {
    upcomingThisWeek: number;
    openFollowUps: number;
    partnerMeetingsScheduled: number;
  };
};

function mapPartnerRow(p: {
  id: string;
  name: string;
  type: string | null;
  stage: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  relationshipLeadId: string | null;
}): PartnerRecord {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    stage: p.stage,
    lastContactedAt: p.lastContactedAt,
    nextFollowUpAt: p.nextFollowUpAt,
    hasRelationshipLead: Boolean(p.relationshipLeadId),
    confirmedRoom: false,
    confirmedTimes: false,
    confirmedLaunchDate: false,
    hasSupervisor: false,
    writtenConfirmation: false,
    openIssues: 0,
  };
}

function workspaceMissing(row: {
  id: string;
  title: string;
  agenda: string | null;
  proposal: string | null;
  notes: string | null;
  nextSteps: string | null;
  outcome: string | null;
  facilitatorId: string | null;
  partnerId: string | null;
  status: string;
  _count: { followUps: number; officerTopics: number };
}): string[] {
  const missing: string[] = [];
  if (!row.agenda?.trim() && row._count.officerTopics === 0) missing.push("agenda");
  if (!row.proposal?.trim()) missing.push("proposal");
  if (row.status === "COMPLETED" && !row.outcome?.trim() && row._count.followUps === 0) missing.push("outcome");
  if (!row.facilitatorId) missing.push("owner");
  if (!row.partnerId) missing.push("partner");
  if (row.status === "COMPLETED" && !row.notes?.trim()) missing.push("notes");
  return missing;
}

export async function loadMeetingsCommandCenter(viewer: SessionUser): Promise<MeetingsCommandCenter> {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const userRow = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { chapterId: true },
  });
  const chapterId = userRow?.chapterId ?? null;
  const chapterOs = chapterId ? await loadChapterOperatingSystem(chapterId) : null;

  const [meetingRows, partnerRows] = await Promise.all([
    withPrismaFallback(
      "meetings-cc:meetings",
      () =>
        prisma.meeting.findMany({
          where: {
            status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
            scheduledAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { scheduledAt: "asc" },
          take: 80,
          select: {
            id: true,
            title: true,
            agenda: true,
            proposal: true,
            notes: true,
            nextSteps: true,
            outcome: true,
            facilitatorId: true,
            partnerId: true,
            status: true,
            scheduledAt: true,
            _count: { select: { followUps: true, officerTopics: true } },
          },
        }),
      [],
    ),
    withPrismaFallback(
      "meetings-cc:partners",
      () =>
        prisma.partner.findMany({
          where: {
            archivedAt: null,
            ...(chapterId ? { chapterId } : {}),
          },
          take: 200,
          select: {
            id: true,
            name: true,
            type: true,
            stage: true,
            lastContactedAt: true,
            nextFollowUpAt: true,
            relationshipLeadId: true,
          },
        }),
      [],
    ),
  ]);

  const partners = partnerRows.map(mapPartnerRow);
  const pipeline = partners.length > 0 ? summarizePartnerPipeline(partners, now) : null;

  const alerts: MeetingAlert[] = [];
  const meetingsNeedingWorkspace: MeetingsCommandCenter["meetingsNeedingWorkspace"] = [];
  let upcomingThisWeek = 0;
  let openFollowUps = 0;

  for (const m of meetingRows) {
    if (m.scheduledAt <= weekAhead && (m.status === "SCHEDULED" || m.status === "IN_PROGRESS")) {
      upcomingThisWeek += 1;
    }
    openFollowUps += m._count.followUps;

    const missing = workspaceMissing(m);
    if (missing.length >= 2 || (m.status === "COMPLETED" && missing.includes("outcome"))) {
      meetingsNeedingWorkspace.push({
        id: m.id,
        title: m.title,
        missing,
        href: `/meetings/${m.id}`,
      });
    }

    if (m.status === "COMPLETED" && !m.outcome?.trim() && m._count.followUps === 0) {
      alerts.push({
        severity: "warning",
        title: `“${m.title}” completed with no outcome recorded`,
        href: `/meetings/${m.id}`,
      });
    } else if (
      m.status === "SCHEDULED" &&
      m.scheduledAt.getTime() - now.getTime() < 48 * 60 * 60 * 1000 &&
      !m.agenda?.trim() &&
      m._count.officerTopics === 0
    ) {
      alerts.push({
        severity: "critical",
        title: `“${m.title}” is soon — agenda still empty`,
        href: `/meetings/${m.id}`,
      });
    }
  }

  const partnersNeedingFollowUp = partners
    .map((p) => ({ p, fu: partnerFollowUp(p, now) }))
    .filter((x) => x.fu.needed)
    .slice(0, 8)
    .map((x) => ({
      id: x.p.id,
      name: x.p.name,
      reason: x.fu.reason ?? "Follow-up needed",
      href: `/partners/${x.p.id}`,
    }));

  for (const p of partnersNeedingFollowUp.slice(0, 4)) {
    alerts.push({
      severity: p.reason.includes("overdue") ? "critical" : "warning",
      title: `Partner ${p.name}: ${p.reason}`,
      href: p.href,
    });
  }

  return {
    chapterName: chapterOs?.chapter.name ?? null,
    chapterHref: chapterId ? `/chapter/operating` : null,
    impact: chapterOs?.impact ?? null,
    partnerPipeline: pipeline
      ? {
          total: pipeline.total,
          followUpNeeded: pipeline.followUpNeeded,
          meetingScheduled: pipeline.byStatus.meeting_scheduled,
          confirmed: pipeline.confirmed,
          byStatus: Object.entries(pipeline.byStatus)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => ({
              status,
              label: PARTNER_PLAYBOOK_STATUS_LABELS[status as keyof typeof PARTNER_PLAYBOOK_STATUS_LABELS],
              count,
            })),
        }
      : null,
    instructorPipeline: chapterOs
      ? {
          applicants: chapterOs.instructors.applicants,
          hired: chapterOs.instructors.hired,
          interviewsScheduled: chapterOs.instructors.byStage.interview_scheduled,
          waitingForReview: chapterOs.instructors.waitingForReview,
        }
      : null,
    alerts: alerts.slice(0, 10),
    partnersNeedingFollowUp,
    meetingsNeedingWorkspace: meetingsNeedingWorkspace.slice(0, 6),
    operational: {
      upcomingThisWeek,
      openFollowUps,
      partnerMeetingsScheduled: pipeline?.byStatus.meeting_scheduled ?? 0,
    },
  };
}
