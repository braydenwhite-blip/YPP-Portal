import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { RoleType } from "@prisma/client";

function isValidRole(role: string): role is RoleType {
  return role in RoleType;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const emailsText = String(formData.get("emails") || "");
  const newRoleRaw = String(formData.get("newRole") || "").toUpperCase();
  const chapterId = String(formData.get("chapterId") || "").trim();
  const mode = String(formData.get("mode") || "apply");

  if (!isValidRole(newRoleRaw)) {
    redirect(`/admin/bulk-users?updated=0&failed=0&error=${encodeURIComponent("Invalid role selected")}`);
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        primaryRole: newRoleRaw,
        ...(chapterId ? { chapterId } : {}),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_role: {
          userId: user.id,
          role: newRoleRaw,
        },
      },
      update: {},
      create: {
        userId: user.id,
        role: newRoleRaw,
      },
    });

    updated++;
  }

  redirect(`/admin/bulk-users?updated=${updated}&failed=${failed}${mode === "validate" ? "&dryRun=true" : ""}`);
}
