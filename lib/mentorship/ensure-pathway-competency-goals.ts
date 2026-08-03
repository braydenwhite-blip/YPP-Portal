import "server-only";

import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { buildGRMentorList, buildGROfficerInfo } from "@/lib/gr-contact";
import { TRACKS, resolveStartingPosition } from "@/lib/growth-pathway";
import { prisma } from "@/lib/prisma";

type CompetencyGoalRow = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  grDocumentGoalId: string;
  legacyGoalId: null;
};

/**
 * Ensures the mentee has ACTIVE COMPETENCY goals for their pathway track.
 * Creates a minimal G&R document when needed. Used by Performance Review
 * so the competency table always has the five rubric rows.
 */
export async function ensurePathwayCompetencyGoals(input: {
  menteeId: string;
  mentorshipId: string;
  actorId: string;
}): Promise<CompetencyGoalRow[]> {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: input.mentorshipId },
    select: {
      id: true,
      status: true,
      menteeId: true,
      mentee: {
        select: {
          name: true,
          email: true,
          phone: true,
          title: true,
          canonicalTitle: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
      mentor: {
        select: {
          name: true,
          email: true,
          phone: true,
          title: true,
          canonicalTitle: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
      chair: {
        select: {
          name: true,
          email: true,
          phone: true,
          title: true,
          canonicalTitle: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
    },
  });
  if (!mentorship || mentorship.status !== "ACTIVE") {
    return [];
  }
  if (mentorship.menteeId !== input.menteeId) {
    return [];
  }

  const { trackId, roleId } = resolveStartingPosition({
    stageId: null,
    primaryRole: mentorship.mentee.primaryRole,
    title: mentorship.mentee.title ?? mentorship.mentee.canonicalTitle,
  });
  const competencies = TRACKS[trackId].competencies;
  const titleSet = new Set(competencies.map((c) => c.title.trim().toLowerCase()));

  let document = await prisma.gRDocument.findFirst({
    where: {
      userId: input.menteeId,
      mentorshipId: input.mentorshipId,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "ACTIVE"] },
    },
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!document) {
    const roleType =
      toMenteeRoleType(mentorship.mentee.primaryRole ?? null) ?? "INSTRUCTOR";
    const menteeName = mentorship.mentee.name?.trim() || "mentee";

    document = await prisma.$transaction(async (tx) => {
      const template = await tx.gRTemplate.create({
        data: {
          title: `Goals & Rubric for ${menteeName}`,
          roleType: roleType as never,
          roleMission: `Role expectations for ${menteeName} (${roleId}).`,
          status: "GR_APPROVED",
          publishedAt: new Date(),
          isActive: false,
          createdById: input.actorId,
          lastEditedById: input.actorId,
        },
        select: { id: true },
      });

      return tx.gRDocument.create({
        data: {
          userId: input.menteeId,
          mentorshipId: input.mentorshipId,
          templateId: template.id,
          roleMission: `Role expectations for ${menteeName}.`,
          roleStartDate: new Date(),
          status: "ACTIVE",
          officerInfo: buildGROfficerInfo(mentorship.mentee, null) as never,
          mentorInfo: {
            mentors: buildGRMentorList({
              mentor: mentorship.mentor,
              chair: mentorship.chair,
            }),
          } as never,
          goals: {
            create: competencies.map((c, index) => ({
              title: c.title,
              description: "",
              timePhase: "LONG_TERM" as const,
              sortOrder: index,
              isCustom: true,
              kind: "COMPETENCY" as const,
              lifecycleStatus: "ACTIVE" as const,
            })),
          },
        },
        select: { id: true, status: true },
      });
    });
  } else {
    const existing = await prisma.gRDocumentGoal.findMany({
      where: {
        documentId: document.id,
        lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: { id: true, title: true, kind: true },
    });

    const haveTitle = new Set(
      existing.map((g) => g.title.trim().toLowerCase()),
    );
    const missing = competencies.filter(
      (c) => !haveTitle.has(c.title.trim().toLowerCase()),
    );

    if (missing.length > 0) {
      const maxSort = await prisma.gRDocumentGoal.aggregate({
        where: { documentId: document.id },
        _max: { sortOrder: true },
      });
      let next = (maxSort._max.sortOrder ?? 0) + 1;
      await prisma.gRDocumentGoal.createMany({
        data: missing.map((c) => ({
          documentId: document!.id,
          title: c.title,
          description: "",
          timePhase: "LONG_TERM" as const,
          sortOrder: next++,
          isCustom: true,
          kind: "COMPETENCY" as const,
          lifecycleStatus: "ACTIVE" as const,
        })),
      });
    }

    // Promote title-matched rows to COMPETENCY when they were stored as GOAL.
    const toPromote = existing.filter(
      (g) =>
        g.kind !== "COMPETENCY" &&
        titleSet.has(g.title.trim().toLowerCase()),
    );
    for (const row of toPromote) {
      await prisma.gRDocumentGoal.update({
        where: { id: row.id },
        data: { kind: "COMPETENCY" },
      });
    }

    if (document.status !== "ACTIVE") {
      await prisma.gRDocument.update({
        where: { id: document.id },
        data: { status: "ACTIVE" },
      });
    }
  }

  const rows = await prisma.gRDocumentGoal.findMany({
    where: {
      documentId: document.id,
      lifecycleStatus: "ACTIVE",
      OR: [
        { kind: "COMPETENCY" },
        { title: { in: competencies.map((c) => c.title) } },
      ],
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      sortOrder: true,
    },
  });

  // Stable pathway order
  const order = new Map(competencies.map((c, i) => [c.title.toLowerCase(), i]));
  return rows
    .map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      sortOrder: order.get(g.title.trim().toLowerCase()) ?? g.sortOrder,
      grDocumentGoalId: g.id,
      legacyGoalId: null as null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
