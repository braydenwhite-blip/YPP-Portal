import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const instructorId = formData.get("instructorId") as string;
  const level_101 = formData.get("level_101") === "true";
  const level_201 = formData.get("level_201") === "true";
  const level_301 = formData.get("level_301") === "true";
  const notes = formData.get("notes") as string | null;

  // Create approval
  const approval = await prisma.instructorApproval.create({
    data: {
      instructorId,
      approvedById: session.user.id,
      approvedAt: new Date(),
      notes: notes || null
    }
  });

  // Create level approvals
  const levels = [];
  if (level_101) levels.push({ approvalId: approval.id, level: "LEVEL_101" });
  if (level_201) levels.push({ approvalId: approval.id, level: "LEVEL_201" });
  if (level_301) levels.push({ approvalId: approval.id, level: "LEVEL_301" });

  if (levels.length > 0) {
    await prisma.approvedLevel.createMany({
      data: levels as any
    });
  }

  redirect("/admin/instructor-approvals");
}
