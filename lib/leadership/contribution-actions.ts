"use server";

// Leadership Roles & Contributions — server actions for assigning and
// managing contribution records. Admins assign/update/delete; the assigned
// instructor can log activity and mark their own role completed/active so the
// roles stay actionable, not just informational.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  LeadershipContributionStatus,
  LeadershipExpectedLevel,
  LeadershipRoleCategory,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { requireAdmin } from "@/lib/authorization-helpers";
import {
  CONTRIBUTION_ACTIVITY_KINDS,
  LEADERSHIP_ROLE_CATALOG,
} from "./constants";

const LEADERSHIP_PATHS = [
  "/admin/leadership",
  "/my-leadership",
  "/my-advisees",
];

function revalidateLeadership(instructorId?: string) {
  for (const path of LEADERSHIP_PATHS) revalidatePath(path);
  if (instructorId) revalidatePath(`/admin/instructors/${instructorId}`);
}

async function requireSessionUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id) throw new Error("Unauthorized");
  return user as { id: string; roles?: string[] };
}

function isAdminUser(user: { roles?: string[] }): boolean {
  return (user.roles ?? []).includes("ADMIN");
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign / update contributions (admin)
// ─────────────────────────────────────────────────────────────────────────────

const assignContributionSchema = z.object({
  instructorId: z.string().min(1),
  category: z.nativeEnum(LeadershipRoleCategory),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.nativeEnum(LeadershipContributionStatus).optional(),
  expectedLevel: z.nativeEnum(LeadershipExpectedLevel).optional(),
  weight: z.number().int().min(1).max(3).optional(),
  isOwnership: z.boolean().optional(),
  relatedUserId: z.string().optional(),
  relatedOfferingId: z.string().optional(),
  relatedPartnerId: z.string().optional(),
  relatedProgram: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(8000).optional(),
  reviewVisible: z.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export async function assignContribution(
  input: z.infer<typeof assignContributionSchema>,
) {
  const admin = await requireAdmin();
  const data = assignContributionSchema.parse(input);
  const definition = LEADERSHIP_ROLE_CATALOG[data.category];

  const contribution = await prisma.leadershipContribution.create({
    data: {
      instructorId: data.instructorId,
      category: data.category,
      title: data.title || definition.label,
      description: data.description || null,
      status: data.status ?? "ASSIGNED",
      expectedLevel: data.expectedLevel ?? definition.defaultLevel,
      weight: data.weight ?? definition.defaultWeight,
      isOwnership: data.isOwnership ?? definition.isOwnership,
      relatedUserId: data.relatedUserId || null,
      relatedOfferingId: data.relatedOfferingId || null,
      relatedPartnerId: data.relatedPartnerId || null,
      relatedProgram: data.relatedProgram || null,
      notes: data.notes || null,
      reviewVisible: data.reviewVisible ?? true,
      startDate: data.startDate ?? new Date(),
      endDate: data.endDate ?? null,
      adminOwnerId: admin.id,
      createdById: admin.id,
    },
  });

  revalidateLeadership(data.instructorId);
  return { success: true, contributionId: contribution.id };
}

const updateContributionSchema = assignContributionSchema
  .omit({ instructorId: true, category: true })
  .partial()
  .extend({ adminOwnerId: z.string().optional() });

export async function updateContribution(
  contributionId: string,
  patch: z.infer<typeof updateContributionSchema>,
) {
  await requireAdmin();
  const data = updateContributionSchema.parse(patch);

  const updated = await prisma.leadershipContribution.update({
    where: { id: contributionId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.expectedLevel !== undefined ? { expectedLevel: data.expectedLevel } : {}),
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.isOwnership !== undefined ? { isOwnership: data.isOwnership } : {}),
      ...(data.relatedProgram !== undefined ? { relatedProgram: data.relatedProgram || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.reviewVisible !== undefined ? { reviewVisible: data.reviewVisible } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate ?? null } : {}),
      ...(data.adminOwnerId !== undefined ? { adminOwnerId: data.adminOwnerId || null } : {}),
    },
  });

  revalidateLeadership(updated.instructorId);
  return { success: true };
}

/**
 * Status changes are allowed for admins and for the assigned instructor
 * (instructors can activate, pause, or complete their own role — that is what
 * makes the role actionable from /my-leadership). A STATUS_CHANGE activity is
 * logged so the history is reviewable. Completing sets endDate.
 */
export async function updateContributionStatus(
  contributionId: string,
  status: LeadershipContributionStatus,
) {
  const user = await requireSessionUser();
  const contribution = await prisma.leadershipContribution.findUnique({
    where: { id: contributionId },
    select: { id: true, instructorId: true, status: true },
  });
  if (!contribution) throw new Error("Contribution not found");
  if (!isAdminUser(user) && contribution.instructorId !== user.id) {
    throw new Error("Forbidden");
  }

  await prisma.$transaction([
    prisma.leadershipContribution.update({
      where: { id: contributionId },
      data: {
        status,
        ...(status === "COMPLETED" ? { endDate: new Date() } : {}),
        ...(status === "ACTIVE" ? { endDate: null } : {}),
      },
    }),
    prisma.leadershipContributionActivity.create({
      data: {
        contributionId,
        authorId: user.id,
        kind: "STATUS_CHANGE",
        body: `Status changed from ${contribution.status} to ${status}.`,
      },
    }),
  ]);

  revalidateLeadership(contribution.instructorId);
  return { success: true };
}

export async function deleteContribution(contributionId: string) {
  await requireAdmin();
  const contribution = await prisma.leadershipContribution.delete({
    where: { id: contributionId },
    select: { instructorId: true },
  });
  revalidateLeadership(contribution.instructorId);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity log (admin or assigned instructor)
// ─────────────────────────────────────────────────────────────────────────────

const logActivitySchema = z.object({
  contributionId: z.string().min(1),
  kind: z.enum(CONTRIBUTION_ACTIVITY_KINDS).default("NOTE"),
  body: z.string().trim().min(1).max(8000),
});

export async function logContributionActivity(
  input: z.infer<typeof logActivitySchema>,
) {
  const user = await requireSessionUser();
  const data = logActivitySchema.parse(input);

  const contribution = await prisma.leadershipContribution.findUnique({
    where: { id: data.contributionId },
    select: { id: true, instructorId: true },
  });
  if (!contribution) throw new Error("Contribution not found");
  if (!isAdminUser(user) && contribution.instructorId !== user.id) {
    throw new Error("Forbidden");
  }

  await prisma.leadershipContributionActivity.create({
    data: {
      contributionId: data.contributionId,
      authorId: user.id,
      kind: data.kind,
      body: data.body,
    },
  });

  revalidateLeadership(contribution.instructorId);
  return { success: true };
}
