import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { RoleType } from "@prisma/client";
import {
  buildUserRoleRecords,
  resolveUserAccessSelection,
} from "@/lib/admin-user-access";

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
  const emailsText = String(formData.get("emails") || "");
  const primaryRoleRaw = String(
    formData.get("primaryRole") || formData.get("newRole") || ""
  ).toUpperCase();
  const chapterId = String(formData.get("chapterId") || "").trim();
  const mode = String(formData.get("mode") || "apply");

  let access: ReturnType<typeof resolveUserAccessSelection>;
  try {
    access = resolveUserAccessSelection({
      primaryRoleRaw,
      roleValues: formData.getAll("roles").map(String),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid role selection";
    redirect(
      `/admin/bulk-users?updated=0&failed=0&error=${encodeURIComponent(message)}`
    );
  }

  if (chapterId) {
    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true } });
    if (!chapter) {
      redirect(`/admin/bulk-users?updated=0&failed=0&error=${encodeURIComponent("Selected chapter does not exist")}`);
    }
  }

  const emails = emailsText
    .split(/\r?\n/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  if (emails.length === 0) {
    redirect(`/admin/bulk-users?updated=0&failed=0&error=${encodeURIComponent("No emails provided")}`);
  }

  let updated = 0;
  let failed = 0;

  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      failed++;
      continue;
    }

    if (mode === "validate") {
      updated++;
      continue;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          primaryRole: access.primaryRole,
          ...(chapterId ? { chapterId } : {}),
        },
      }),
      prisma.userRole.deleteMany({
        where: { userId: user.id },
      }),
      prisma.userRole.createMany({
        data: buildUserRoleRecords(user.id, access.roles),
      }),
      ...(access.roles.includes(RoleType.ADMIN)
        ? []
        : [
            prisma.userAdminSubtype.deleteMany({
              where: { userId: user.id },
            }),
          ]),
    ]);

    updated++;
  }

  redirect(`/admin/bulk-users?updated=${updated}&failed=${failed}${mode === "validate" ? "&dryRun=true" : ""}`);
}
