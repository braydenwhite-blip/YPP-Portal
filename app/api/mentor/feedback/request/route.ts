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
  const question = formData.get("question") as string;

  // Create feedback request
  const feedbackRequest = await prisma.mentorFeedbackRequest.create({
    data: {
      studentId: session.user.id,
      passionId,
      projectId: projectId || null,
      question,
      mediaUrls: [], // In production, handle file uploads
      status: "PENDING"
    }
  });

  // Create notification for mentors (in production)
  // await createMentorNotification(passionId, feedbackRequest.id);

  redirect("/mentor/feedback");
}
