"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildUserRoleRecords, resolveUserAccessSelection } from "@/lib/admin-user-access";
import { requireAdmin } from "@/lib/authorization-helpers";
import {
  TITLE_AUTHORITY,
  normalizeTitle,
  type CanonicalTitle,
} from "@/lib/org/levels";
import { prisma } from "@/lib/prisma";

const KEEP = "__KEEP__";
const CLEAR = "__CLEAR__";
const NONE = "__NONE__";

/**
 * Resolve a chapter sentinel ("__KEEP__" / "__CLEAR__" / id) into a Prisma
 * patch. Returns an empty object when the value should be left untouched.
 */
async function resolveChapterPatch(
  value: string
): Promise<{ chapterId?: string | null }> {
  if (!value || value === KEEP) return {};
  if (value === CLEAR) return { chapterId: null };
  const chapter = await prisma.chapter.findUnique({
    where: { id: value },
    select: { id: true },
  });
  if (!chapter) throw new Error("Selected chapter does not exist.");
  return { chapterId: value };
}

/**
 * Resolve a cohort sentinel ("__KEEP__" / "__NONE__" / id) into a Prisma patch.
 */
async function resolveCohortPatch(
  value: string
): Promise<{ cohortId?: string | null }> {
  if (!value || value === KEEP) return {};
  if (value === NONE || value === CLEAR) return { cohortId: null };
  const cohort = await prisma.cohort.findUnique({
    where: { id: value },
    select: { id: true },
  });
  if (!cohort) throw new Error("Selected cohort does not exist.");
  return { cohortId: value };
}

/**
 * Resolve a ladder/level selection (a canonical title sentinel) into the org
 * authority spine patch. A canonical title fully determines the ladder and the
 * internal level via TITLE_AUTHORITY, so persisting all three keeps
 * `resolvePersonAuthority` reading from the PERSISTED source. "__CLEAR__" unsets
 * the spine (the person falls back to role/title-derived authority).
 */
function resolveLadderPatch(value: string): {
  canonicalTitle?: string | null;
  ladder?: "INSTRUCTION" | "LEADERSHIP" | null;
  internalLevel?: number | null;
} {
  if (!value || value === KEEP) return {};
  if (value === CLEAR || value === NONE) {
    return { canonicalTitle: null, ladder: null, internalLevel: null };
  }
  const title = normalizeTitle(value);
  if (!title) throw new Error("Unknown ladder title.");
  const meta = TITLE_AUTHORITY[title as CanonicalTitle];
  return {
    canonicalTitle: title,
    ladder: meta.ladder,
    internalLevel: meta.internalLevel,
  };
}

const SetUserAccessSchema = z.object({
  userId: z.string().min(1, "A user is required."),
  primaryRole: z.string().min(1, "A primary role is required."),
  roles: z.array(z.string()).optional().default([]),
  chapterId: z.string().optional().default(KEEP),
  // Ladder/level expressed as a canonical title (e.g. "Senior Instructor").
  title: z.string().optional().default(KEEP),
  cohortId: z.string().optional().default(KEEP),
});

/**
 * Full save from the Role Management editor modal: primary role, the role list,
 * chapter, ladder/level (org authority spine), and cohort. Admin subtypes are no
 * longer managed here — access now flows from the ladder/level spine and cohort.
 */
export async function setUserAccess(input: unknown) {
  await requireAdmin();
  const data = SetUserAccessSchema.parse(input);

  const access = resolveUserAccessSelection({
    primaryRoleRaw: data.primaryRole.toUpperCase(),
    roleValues: data.roles,
  });

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) throw new Error("No user was found.");

  const [chapterPatch, cohortPatch] = await Promise.all([
    resolveChapterPatch(data.chapterId),
    resolveCohortPatch(data.cohortId),
  ]);
  const ladderPatch = resolveLadderPatch(data.title);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        primaryRole: access.primaryRole,
        ...chapterPatch,
        ...cohortPatch,
        ...ladderPatch,
      },
    }),
    prisma.userRole.deleteMany({ where: { userId: user.id } }),
    prisma.userRole.createMany({
      data: buildUserRoleRecords(user.id, access.roles),
    }),
  ]);

  revalidatePath("/admin/role-management");
  return { ok: true };
}

const SetUserGroupSchema = z.object({
  userId: z.string().min(1, "A user is required."),
  // Either or both may be sent; "__KEEP__" leaves that dimension unchanged.
  title: z.string().optional().default(KEEP),
  cohortId: z.string().optional().default(KEEP),
});

/**
 * Inline quick-assign from a table row: move a person to a different group
 * (ladder/level) and/or cohort without opening the full editor. Only the
 * dimensions that are not "__KEEP__" are touched.
 */
export async function setUserGroup(input: unknown) {
  await requireAdmin();
  const data = SetUserGroupSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) throw new Error("No user was found.");

  const cohortPatch = await resolveCohortPatch(data.cohortId);
  const ladderPatch = resolveLadderPatch(data.title);

  if (
    Object.keys(cohortPatch).length === 0 &&
    Object.keys(ladderPatch).length === 0
  ) {
    return { ok: true };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ...cohortPatch, ...ladderPatch },
  });

  revalidatePath("/admin/role-management");
  return { ok: true };
}

const CreateCohortSchema = z.object({
  name: z.string().trim().min(1, "A cohort name is required.").max(120),
});

/**
 * Create a new named cohort (people group) so admins have groups to assign
 * users to. Names are unique.
 */
export async function createCohort(input: unknown) {
  await requireAdmin();
  const data = CreateCohortSchema.parse(input);

  const existing = await prisma.cohort.findUnique({
    where: { name: data.name },
    select: { id: true },
  });
  if (existing) throw new Error("A cohort with that name already exists.");

  const cohort = await prisma.cohort.create({
    data: { name: data.name },
    select: { id: true, name: true },
  });

  revalidatePath("/admin/role-management");
  return { ok: true, cohort };
}
