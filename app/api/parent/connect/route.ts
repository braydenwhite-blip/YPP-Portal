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
  const studentEmail = formData.get("studentEmail") as string;
  const relationship = formData.get("relationship") as string;
  const isPrimary = formData.get("isPrimary") === "on";

  // Find student by email
  const student = await prisma.user.findUnique({
    where: { email: studentEmail }
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Create or get parent profile
  let parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!parentProfile) {
    parentProfile = await prisma.parentProfile.create({
      data: { userId: session.user.id }
    });
  }

  // Create parent-student connection (pending approval)
  await prisma.parentStudentConnection.create({
    data: {
      parentId: parentProfile.id,
      studentId: student.id,
      relationship,
      isPrimary,
      canViewProgress: true,
      canReceiveReports: true,
      // approvedAt will be set when student approves
    }
  });

  // In production: Send notification to student about pending connection request
  // await createNotification(student.id, "PARENT_CONNECTION_REQUEST", ...)

  redirect("/parent/connect");
}
