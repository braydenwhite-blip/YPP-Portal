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

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";
  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const type = formData.get("type") as string;
  const courseId = formData.get("courseId") as string | null;
  const subject = formData.get("subject") as string;
  const details = formData.get("details") as string;

  await prisma.curriculumFeedback.create({
    data: {
      instructorId: session.user.id,
      type: type as any,
      courseId: courseId || null,
      subject,
      details,
      status: "SUBMITTED"
    }
  });

  redirect("/instructor/curriculum-feedback");
}
