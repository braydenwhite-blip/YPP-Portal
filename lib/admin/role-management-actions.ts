"use server";

import { revalidatePath } from "next/cache";
import { AdminSubtype, Prisma, RoleType } from "@prisma/client";
import { z } from "zod";

import { validateEnum } from "@/lib/validate-enum";

import {
  buildUserAdminSubtypeRecords,
  buildUserRoleRecords,
  resolveUserAccessSelection,
} from "@/lib/admin-user-access";
import { requireAdmin } from "@/lib/authorization-helpers";
import {
  TITLE_AUTHORITY,
  normalizeTitle,
  roleForTitle,
  subtypesForTitle,
  type CanonicalTitle,
} from "@/lib/org/levels";
import { requireOperatingChapterId } from "@/lib/chapters/operating";
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
  const chapterId = await requireOperatingChapterId(value, {
    label: "User chapter",
  });
  return { chapterId };
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

/**
 * Ops that sync the legacy ADMIN role + admin subtype(s) implied by a canonical
 * ladder title, leaving all other roles intact. Used by the inline quick-assign
 * so it stays consistent with `setUserAccess` (which achieves the same via its
 * full role rewrite). A non-officer title (or null) strips the derived access.
 */
function adminShapeOpsForTitle(
  userId: string,
  title: CanonicalTitle | null
): Prisma.PrismaPromise<unknown>[] {
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (roleForTitle(title) === "ADMIN") {
    ops.push(
      prisma.userRole.upsert({
        where: { userId_role: { userId, role: RoleType.ADMIN } },
        create: { userId, role: RoleType.ADMIN },
        update: {},
      })
    );
  } else {
    ops.push(
      prisma.userRole.deleteMany({ where: { userId, role: RoleType.ADMIN } })
    );
  }
  ops.push(prisma.userAdminSubtype.deleteMany({ where: { userId } }));
  const records = subtypesForTitle(title).map((value) => ({
    userId,
    subtype: validateEnum(AdminSubtype, value, "adminSubtype"),
    isDefaultOwner: false,
  }));
  if (records.length > 0) {
    ops.push(prisma.userAdminSubtype.createMany({ data: records }));
  }
  return ops;
}

const SetUserAccessSchema = z.object({
  userId: z.string().min(1, "A user is required."),
  primaryRole: z.string().min(1, "A primary role is required."),
  roles: z.array(z.string()).optional().default([]),
  chapterId: z.string().optional().default(KEEP),
  // Ladder/level expressed as a canonical title (e.g. "Senior Instructor").
  title: z.string().optional().default(KEEP),
  cohortId: z.string().optional().default(KEEP),
  orgFunctionId: z.string().optional().default(KEEP),
  orgDepartmentId: z.string().optional().default(KEEP),
});

async function resolveOrgFunctionPatch(
  value: string
): Promise<{ orgFunctionId?: string | null }> {
  if (!value || value === KEEP) return {};
  if (value === CLEAR || value === NONE) return { orgFunctionId: null };
  const row = await prisma.orgFunction.findFirst({
    where: { id: value, archivedAt: null },
    select: { id: true },
  });
  if (!row) throw new Error("Selected function does not exist.");
  return { orgFunctionId: value };
}

async function resolveOrgDepartmentPatch(
  value: string,
  functionId: string | null | undefined
): Promise<{ orgDepartmentId?: string | null }> {
  if (!value || value === KEEP) return {};
  if (value === CLEAR || value === NONE) return { orgDepartmentId: null };
  const row = await prisma.department.findFirst({
    where: { id: value, archivedAt: null },
    select: { id: true, functionId: true },
  });
  if (!row) throw new Error("Selected department does not exist.");
  if (functionId && row.functionId && row.functionId !== functionId) {
    throw new Error("Department must belong to the selected function.");
  }
  return { orgDepartmentId: value };
}

/**
 * Full save from the Role Management editor modal: primary role, the role list,
 * chapter, ladder/level (org authority spine), and cohort.
 *
 * The ladder TITLE is the single source of truth for admin access: the legacy
 * `ADMIN` role + admin subtype(s) it implies are derived here (Board Member →
 * SUPER_ADMIN, Senior Officer → LEADERSHIP, Officer → ADMIN) rather than set by
 * hand, so the many `requireAdmin()` / `roles.includes("ADMIN")` call sites keep
 * working off the ladder. Picking a non-officer title (or clearing it) strips the
 * derived admin access. This only touches the admin shape when the title
 * dimension is actually provided (not "__KEEP__").
 */
export async function setUserAccess(input: unknown) {
  await requireAdmin();
  const data = SetUserAccessSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) throw new Error("No user was found.");

  const titleProvided = data.title !== KEEP;
  const canonicalTitle =
    titleProvided && data.title !== CLEAR && data.title !== NONE
      ? normalizeTitle(data.title)
      : null;

  // When the title is provided, it drives the ADMIN role: strip any hand-set
  // ADMIN and re-derive it (and the subtype) from the chosen title.
  let roleValues = [...data.roles];
  let adminSubtypeValues: string[] | undefined;
  if (titleProvided) {
    roleValues = roleValues.filter((role) => role.toUpperCase() !== "ADMIN");
    const derivedRole = roleForTitle(canonicalTitle);
    if (derivedRole) roleValues.push(derivedRole);
    adminSubtypeValues = subtypesForTitle(canonicalTitle); // [] clears the table
  }

  const access = resolveUserAccessSelection({
    primaryRoleRaw: data.primaryRole.toUpperCase(),
    roleValues,
    adminSubtypeValues,
  });

  const [chapterPatch, cohortPatch, functionPatch] = await Promise.all([
    resolveChapterPatch(data.chapterId),
    resolveCohortPatch(data.cohortId),
    resolveOrgFunctionPatch(data.orgFunctionId),
  ]);
  const nextFunctionId =
    functionPatch.orgFunctionId !== undefined
      ? functionPatch.orgFunctionId
      : undefined;
  // When function is cleared, also clear department unless explicitly set.
  const departmentPatch = await resolveOrgDepartmentPatch(
    data.orgDepartmentId,
    nextFunctionId ?? null
  );
  if (functionPatch.orgFunctionId === null && data.orgDepartmentId === KEEP) {
    departmentPatch.orgDepartmentId = null;
  }
  const ladderPatch = resolveLadderPatch(data.title);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.update({
      where: { id: user.id },
      data: {
        primaryRole: access.primaryRole,
        ...chapterPatch,
        ...cohortPatch,
        ...functionPatch,
        ...departmentPatch,
        ...ladderPatch,
      },
    }),
    prisma.userRole.deleteMany({ where: { userId: user.id } }),
    prisma.userRole.createMany({
      data: buildUserRoleRecords(user.id, access.roles),
    }),
  ];
  if (titleProvided) {
    ops.push(prisma.userAdminSubtype.deleteMany({ where: { userId: user.id } }));
    if (access.adminSubtypes.length > 0) {
      ops.push(
        prisma.userAdminSubtype.createMany({
          data: buildUserAdminSubtypeRecords(
            user.id,
            access.adminSubtypes,
            access.defaultOwnerSubtype
          ),
        })
      );
    }
  }

  await prisma.$transaction(ops);

  revalidatePath("/admin");
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

  const titleProvided = data.title !== KEEP;
  const canonicalTitle =
    titleProvided && data.title !== CLEAR && data.title !== NONE
      ? normalizeTitle(data.title)
      : null;

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.update({
      where: { id: user.id },
      data: { ...cohortPatch, ...ladderPatch },
    }),
  ];
  // A ladder title change drives admin access too — keep it in sync.
  if (titleProvided) {
    ops.push(...adminShapeOpsForTitle(user.id, canonicalTitle));
  }

  await prisma.$transaction(ops);

  revalidatePath("/admin");
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

  revalidatePath("/admin");
  revalidatePath("/admin/role-management");
  return { ok: true, cohort };
}

const optionalText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

const UpdateAdminUserRowSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  phone: optionalText,
  title: optionalText,
  primaryRole: z.string().optional(),
  /** Canonical org title (Manager, Board Member, …). "__CLEAR__" unsets. */
  orgTitle: z.string().optional(),
  chapterId: z.string().optional().default(KEEP),
  cohortId: z.string().optional().default(KEEP),
  /** Profile city/location. Pass null/"" to clear. Omit to leave unchanged. */
  location: z.string().nullable().optional(),
  school: optionalText,
  schoolGrade: z.number().int().min(1).max(12).nullable().optional(),
  dateOfBirth: optionalText,
  parentEmail: optionalText,
  parentPhone: optionalText,
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
  college: optionalText,
  major: optionalText,
});

/**
 * Full person save from the Admin Users detail modal — identity, profile,
 * school/alumni facts, and access (role / org title / chapter / cohort).
 */
export async function updateAdminUserRow(input: unknown) {
  await requireAdmin();
  const data = UpdateAdminUserRowSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      supabaseAuthId: true,
      roles: { select: { role: true } },
      profile: { select: { id: true } },
      alumniProfile: { select: { id: true } },
    },
  });
  if (!user) throw new Error("No user was found.");

  if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
    const taken = await prisma.user.findFirst({
      where: {
        email: { equals: data.email, mode: "insensitive" },
        NOT: { id: user.id },
      },
      select: { id: true },
    });
    if (taken) throw new Error("Another account already uses that email.");
  }

  const chapterPatch = await resolveChapterPatch(data.chapterId);
  const cohortPatch = await resolveCohortPatch(data.cohortId);

  const roleChanging = Boolean(data.primaryRole);
  let primaryRole = user.primaryRole;
  let roleList = user.roles.map((r) => r.role);

  if (roleChanging && data.primaryRole) {
    const access = resolveUserAccessSelection({
      primaryRoleRaw: data.primaryRole.toUpperCase(),
      roleValues: [data.primaryRole.toUpperCase()],
    });
    primaryRole = access.primaryRole;
    const extras = roleList.filter(
      (r) => r !== user.primaryRole && r !== RoleType.ADMIN && r !== primaryRole
    );
    roleList = Array.from(new Set([primaryRole, ...extras, ...access.roles]));
  }

  const orgTitleProvided = data.orgTitle !== undefined;
  const ladderPatch = orgTitleProvided
    ? resolveLadderPatch(data.orgTitle ?? CLEAR)
    : {};
  const nextCanonicalTitle =
    orgTitleProvided && data.orgTitle && data.orgTitle !== CLEAR && data.orgTitle !== NONE
      ? normalizeTitle(data.orgTitle)
      : orgTitleProvided
        ? null
        : undefined;

  const locationProvided = data.location !== undefined;
  const nextLocation =
    locationProvided && data.location != null && data.location.trim()
      ? data.location.trim().slice(0, 120)
      : locationProvided
        ? null
        : undefined;

  const profileTouched =
    locationProvided ||
    data.school !== undefined ||
    data.schoolGrade !== undefined ||
    data.dateOfBirth !== undefined ||
    data.parentEmail !== undefined ||
    data.parentPhone !== undefined;

  const alumniTouched =
    data.graduationYear !== undefined ||
    data.college !== undefined ||
    data.major !== undefined;

  const userData: Prisma.UserUpdateInput = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(roleChanging ? { primaryRole } : {}),
    ...chapterPatch,
    ...cohortPatch,
    ...ladderPatch,
  };

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  if (Object.keys(userData).length > 0) {
    ops.push(prisma.user.update({ where: { id: user.id }, data: userData }));
  }

  if (roleChanging) {
    ops.push(
      prisma.userRole.deleteMany({ where: { userId: user.id } }),
      prisma.userRole.createMany({
        data: buildUserRoleRecords(user.id, roleList),
      })
    );
  }

  if (orgTitleProvided) {
    ops.push(...adminShapeOpsForTitle(user.id, nextCanonicalTitle ?? null));
  }

  if (profileTouched) {
    let city: string | null | undefined = undefined;
    let stateProvince: string | null | undefined = undefined;
    if (locationProvided) {
      if (nextLocation) {
        const [cityPart, ...rest] = nextLocation.split(",");
        city = (cityPart ?? "").trim() || null;
        stateProvince = rest.join(",").trim() || null;
      } else {
        city = null;
        stateProvince = null;
      }
    }

    const profileData = {
      ...(city !== undefined ? { city } : {}),
      ...(stateProvince !== undefined ? { stateProvince } : {}),
      ...(data.school !== undefined ? { school: data.school } : {}),
      ...(data.schoolGrade !== undefined ? { grade: data.schoolGrade } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.parentEmail !== undefined ? { parentEmail: data.parentEmail } : {}),
      ...(data.parentPhone !== undefined ? { parentPhone: data.parentPhone } : {}),
    };

    ops.push(
      prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          city: city ?? null,
          stateProvince: stateProvince ?? null,
          school: data.school ?? null,
          grade: data.schoolGrade ?? null,
          dateOfBirth: data.dateOfBirth ?? null,
          parentEmail: data.parentEmail ?? null,
          parentPhone: data.parentPhone ?? null,
        },
        update: profileData,
      })
    );
  }

  if (alumniTouched) {
    ops.push(
      prisma.alumniProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          graduationYear: data.graduationYear ?? null,
          college: data.college ?? null,
          major: data.major ?? null,
        },
        update: {
          ...(data.graduationYear !== undefined
            ? { graduationYear: data.graduationYear }
            : {}),
          ...(data.college !== undefined ? { college: data.college } : {}),
          ...(data.major !== undefined ? { major: data.major } : {}),
        },
      })
    );
  }

  if (ops.length === 0) return { ok: true };

  await prisma.$transaction(ops);

  if (
    data.email &&
    data.email.toLowerCase() !== user.email.toLowerCase() &&
    user.supabaseAuthId
  ) {
    const { ensureSupabaseAuthUser } = await import("@/lib/portal-auth-utils");
    await ensureSupabaseAuthUser({
      email: data.email.toLowerCase(),
      existingSupabaseAuthId: user.supabaseAuthId,
      name: data.name ?? user.name,
      portalArchived: false,
      primaryRole: String(primaryRole),
      prismaUserId: user.id,
      roles: roleList.map(String),
    });
  }

  revalidatePath("/admin");
  return { ok: true };
}
