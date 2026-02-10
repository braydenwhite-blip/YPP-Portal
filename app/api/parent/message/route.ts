import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { MessagePriority } from "@prisma/client";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const studentId = formData.get("studentId") as string;
  const instructorId = formData.get("instructorId") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;
  const priorityRaw = formData.get("priority");
  const priority =
    typeof priorityRaw === "string" && Object.values(MessagePriority).includes(priorityRaw as MessagePriority)
      ? (priorityRaw as MessagePriority)
      : MessagePriority.NORMAL;

  // Get parent profile
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!parentProfile) {
    return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
  }

  // Create message
  await prisma.parentMessage.create({
    data: {
      parentId: parentProfile.id,
      studentId,
      instructorId: instructorId || null,
      subject,
      message,
      priority,
      status: "PENDING"
    }
  });

  // In production: Send notification to instructor
  // await createInstructorNotification(instructorId, message.id)

  redirect("/parent/messages");
}
