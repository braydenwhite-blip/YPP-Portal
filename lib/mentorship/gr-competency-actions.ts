"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { buildGRMentorList, buildGROfficerInfo } from "@/lib/gr-contact";
import { prisma } from "@/lib/prisma";
import { TRACKS, resolveStartingPosition } from "@/lib/growth-pathway";

const SaveSchema = z.object({
  mentorshipId: z.string().min(1),
  menteeId: z.string().min(1),
  competencyId: z.string().min(1),
  title: z.string().min(1).max(200),
  roleExamples: z.string().max(8000),
  goalId: z.string().min(1).optional().nullable(),
});

async function assertCanEdit(viewerId: string, mentorshipId: string, roles: string[]) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      status: true,
      mentorId: true,
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
    throw new Error("Active mentorship not found.");
  }
  const isAdmin = roles.includes("ADMIN");
  if (mentorship.mentorId !== viewerId && !isAdmin) {
    throw new Error("Only the assigned mentor can edit role-specific examples.");
  }
  return mentorship;
}

/**
 * Save mentor-authored role-specific examples for one competency on the
 * mentee's G&R. Creates a minimal ACTIVE document when none exists yet.
 */
export async function saveGRCompetencyRoleExamples(input: unknown) {
  const viewer = await requireSessionUser();
  const data = SaveSchema.parse(input);
  const mentorship = await assertCanEdit(
    viewer.id,
    data.mentorshipId,
    viewer.roles ?? [],
  );
  if (mentorship.menteeId !== data.menteeId) {
    throw new Error("Mentee does not match this mentorship.");
  }

  const examples = data.roleExamples.trim();

  let document = await prisma.gRDocument.findFirst({
    where: {
      userId: data.menteeId,
      mentorshipId: data.mentorshipId,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "ACTIVE"] },
    },
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!document) {
    const roleType =
      toMenteeRoleType(mentorship.mentee.primaryRole ?? null) ?? "INSTRUCTOR";
    const menteeName = mentorship.mentee.name?.trim() || "mentee";
    const { trackId, roleId } = resolveStartingPosition({
      stageId: null,
      primaryRole: mentorship.mentee.primaryRole,
      title: mentorship.mentee.title ?? mentorship.mentee.canonicalTitle,
    });
    const competencies = TRACKS[trackId].competencies;

    document = await prisma.$transaction(async (tx) => {
      const template = await tx.gRTemplate.create({
        data: {
          title: `Goals & Rubric for ${menteeName}`,
          roleType: roleType as never,
          roleMission: `Role expectations for ${menteeName} (${roleId}).`,
          status: "GR_APPROVED",
          publishedAt: new Date(),
          isActive: false,
          createdById: viewer.id,
          lastEditedById: viewer.id,
        },
        select: { id: true },
      });

      const created = await tx.gRDocument.create({
        data: {
          userId: data.menteeId,
          mentorshipId: data.mentorshipId,
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
              description:
                c.id === data.competencyId || c.title === data.title
                  ? examples
                  : "",
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
      return created;
    });
  } else {
    if (data.goalId) {
      await prisma.gRDocumentGoal.update({
        where: { id: data.goalId },
        data: { description: examples, kind: "COMPETENCY" },
      });
    } else {
      const existing = await prisma.gRDocumentGoal.findFirst({
        where: {
          documentId: document.id,
          title: data.title,
          lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] },
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.gRDocumentGoal.update({
          where: { id: existing.id },
          data: { description: examples, kind: "COMPETENCY" },
        });
      } else {
        const maxSort = await prisma.gRDocumentGoal.aggregate({
          where: { documentId: document.id },
          _max: { sortOrder: true },
        });
        await prisma.gRDocumentGoal.create({
          data: {
            documentId: document.id,
            title: data.title,
            description: examples,
            timePhase: "LONG_TERM",
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            isCustom: true,
            kind: "COMPETENCY",
            lifecycleStatus: "ACTIVE",
          },
        });
      }
    }

    if (document.status !== "ACTIVE") {
      await prisma.gRDocument.update({
        where: { id: document.id },
        data: { status: "ACTIVE" },
      });
    }
  }

  revalidatePath(`/mentorship/people/${data.menteeId}`);
  return { ok: true as const };
}
