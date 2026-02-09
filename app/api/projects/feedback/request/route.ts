import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const passionId = formData.get("passionId") as string;
  const projectId = formData.get("projectId") as string;
  const milestone = formData.get("milestone") as string;
  const description = formData.get("description") as string;
  const requestedFrom = formData.get("requestedFrom") as string;
  const workSampleUrl = formData.get("workSampleUrl") as string;

  // Create feedback cycle
  await prisma.projectFeedbackCycle.create({
    data: {
      studentId: session.user.id,
      passionId,
      projectId: projectId || null,
      milestone,
      description,
      requestedFrom,
      workSampleUrl: workSampleUrl || null,
      status: "PENDING"
    }
  });

  redirect("/projects/feedback");
}
