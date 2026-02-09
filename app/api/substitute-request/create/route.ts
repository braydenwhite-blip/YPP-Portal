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
  const courseId = formData.get("courseId") as string;
  const sessionDate = formData.get("sessionDate") as string;
  const sessionTime = formData.get("sessionTime") as string;
  const reason = formData.get("reason") as string | null;

  // Combine date and time
  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);

  await prisma.substituteRequest.create({
    data: {
      courseId,
      requestedById: session.user.id,
      sessionDate: sessionDateTime,
      reason: reason || null,
      status: "PENDING"
    }
  });

  redirect("/instructor/substitute-request");
}
