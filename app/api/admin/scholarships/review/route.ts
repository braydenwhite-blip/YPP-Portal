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
  const applicationId = formData.get("applicationId") as string;
  const decision = formData.get("decision") as string;

  await prisma.scholarshipApplication.update({
    where: { id: applicationId },
    data: {
      status: decision as any,
      reviewedAt: new Date(),
      reviewedById: session.user.id
    }
  });

  // Create notification for student
  const application = await prisma.scholarshipApplication.findUnique({
    where: { id: applicationId },
    include: { scholarship: true }
  });

  if (application) {
    await prisma.notification.create({
      data: {
        userId: application.studentId,
        title: `Scholarship Application ${decision}`,
        message: `Your application for ${application.scholarship.name} has been ${decision.toLowerCase()}.`,
        type: "ANNOUNCEMENT"
      }
    });
  }

  redirect("/admin/scholarships");
}
