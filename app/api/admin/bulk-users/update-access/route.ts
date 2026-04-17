import { RoleType } from "@prisma/client";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  buildUserAdminSubtypeRecords,
  buildUserRoleRecords,
  resolveUserAccessSelection,
} from "@/lib/admin-user-access";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

function redirectWithError(message: string, email = ""): never {
  const emailParam = email ? `&manageUser=${encodeURIComponent(email)}` : "";
  redirect(
    `/admin/bulk-users?accessError=${encodeURIComponent(message)}${emailParam}#manage-access`
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const chapterId = String(formData.get("chapterId") || "__KEEP__").trim();

  if (!email) {
    redirectWithError("User email is required.");
  }

  let access: ReturnType<typeof resolveUserAccessSelection>;
  try {
    access = resolveUserAccessSelection({
      primaryRoleRaw: String(formData.get("primaryRole") || "").toUpperCase(),
      roleValues: formData.getAll("roles").map(String),
      adminSubtypeValues: formData.getAll("adminSubtypes").map(String),
      defaultOwnerSubtypeRaw: String(formData.get("defaultOwnerSubtype") || ""),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid access selection.";
    redirectWithError(message, email);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    redirectWithError("No user was found for that email address.", email);
  }

  let chapterPatch: { chapterId?: string | null } = {};
  if (chapterId === "__CLEAR__") {
    chapterPatch = { chapterId: null };
  } else if (chapterId && chapterId !== "__KEEP__") {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true },
    });
    if (!chapter) {
      redirectWithError("Selected chapter does not exist.", email);
    }
    chapterPatch = { chapterId };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        primaryRole: access.primaryRole,
        ...chapterPatch,
      },
    }),
    prisma.userRole.deleteMany({
      where: { userId: user.id },
    }),
    prisma.userRole.createMany({
      data: buildUserRoleRecords(user.id, access.roles),
    }),
    prisma.userAdminSubtype.deleteMany({
      where: { userId: user.id },
    }),
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

  redirect(
    `/admin/bulk-users?accessUpdated=1&accessUser=${encodeURIComponent(
      email
    )}&manageUser=${encodeURIComponent(email)}#manage-access`
  );
}
