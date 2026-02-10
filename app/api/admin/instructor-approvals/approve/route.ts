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
  const instructorIdRaw = formData.get("instructorId");
  const level_101 = formData.get("level_101") === "true";
  const level_201 = formData.get("level_201") === "true";
  const level_301 = formData.get("level_301") === "true";
  const notes = formData.get("notes") as string | null;

  if (typeof instructorIdRaw !== "string" || !instructorIdRaw) {
    return NextResponse.json({ error: "Missing instructorId" }, { status: 400 });
  }
  const instructorId = instructorIdRaw;

  // Create approval
  const approval = await prisma.instructorApproval.create({
    data: {
      instructorId,
      status: "APPROVED",
      notes: notes || null
    }
  });

  // Create level approvals
  const levels: { approvalId: string; level: "LEVEL_101" | "LEVEL_201" | "LEVEL_301" }[] = [];
  if (level_101) levels.push({ approvalId: approval.id, level: "LEVEL_101" });
  if (level_201) levels.push({ approvalId: approval.id, level: "LEVEL_201" });
  if (level_301) levels.push({ approvalId: approval.id, level: "LEVEL_301" });

  if (levels.length > 0) {
    await prisma.instructorApprovalLevel.createMany({
      data: levels
    });
  }

  redirect("/admin/instructor-approvals");
}
