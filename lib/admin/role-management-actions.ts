"use server";

import { RoleType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildUserAdminSubtypeRecords,
  buildUserRoleRecords,
  resolveUserAccessSelection,
} from "@/lib/admin-user-access";
import { requireAdmin } from "@/lib/authorization-helpers";
import { prisma } from "@/lib/prisma";

const SetUserAccessSchema = z.object({
  userId: z.string().min(1, "A user is required."),
  primaryRole: z.string().min(1, "A primary role is required."),
  roles: z.array(z.string()).optional().default([]),
  adminSubtypes: z.array(z.string()).optional().default([]),
  defaultOwnerSubtype: z.string().optional().nullable(),
  // "__KEEP__" leaves the chapter as-is, "__CLEAR__" removes it, any other
  // value assigns that chapter.
  chapterId: z.string().optional().default("__KEEP__"),
});

/**
 * Set one user's exact access: primary role, the full role list, admin
 * subtypes, the default-owner subtype, and (optionally) their chapter. This is
 * the all-users role editor counterpart to the single-user form on
 * /admin/bulk-users — it mirrors that route's transaction so both surfaces stay
 * consistent.
 */
export async function setUserAccess(input: unknown) {
  await requireAdmin();

  const data = SetUserAccessSchema.parse(input);

  const access = resolveUserAccessSelection({
    primaryRoleRaw: data.primaryRole.toUpperCase(),
    roleValues: data.roles,
    adminSubtypeValues: data.adminSubtypes,
    defaultOwnerSubtypeRaw: data.defaultOwnerSubtype ?? "",
  });

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) {
    throw new Error("No user was found.");
  }

  let chapterPatch: { chapterId?: string | null } = {};
  if (data.chapterId === "__CLEAR__") {
    chapterPatch = { chapterId: null };
  } else if (data.chapterId && data.chapterId !== "__KEEP__") {
    const chapter = await prisma.chapter.findUnique({
      where: { id: data.chapterId },
      select: { id: true },
    });
    if (!chapter) {
      throw new Error("Selected chapter does not exist.");
    }
    chapterPatch = { chapterId: data.chapterId };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        primaryRole: access.primaryRole,
        ...chapterPatch,
      },
    }),
    prisma.userRole.deleteMany({ where: { userId: user.id } }),
    prisma.userRole.createMany({
      data: buildUserRoleRecords(user.id, access.roles),
    }),
    prisma.userAdminSubtype.deleteMany({ where: { userId: user.id } }),
    ...(access.roles.includes(RoleType.ADMIN) && access.adminSubtypes.length > 0
      ? [
          prisma.userAdminSubtype.createMany({
            data: buildUserAdminSubtypeRecords(
              user.id,
              access.adminSubtypes,
              access.defaultOwnerSubtype
            ),
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin/role-management");
  return { ok: true };
}
