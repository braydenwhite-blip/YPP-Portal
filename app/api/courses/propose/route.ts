import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.primaryRole !== "INSTRUCTOR" && session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Only instructors can propose courses" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const format = formData.get("format") as string;
    const level = formData.get("level") as string | null;
    const interestArea = formData.get("interestArea") as string;
    const targetAudience = formData.get("targetAudience") as string | null;
    const prerequisites = formData.get("prerequisites") as string | null;
    const learningOutcomes = formData.get("learningOutcomes") as string;
    const resources = formData.get("resources") as string | null;
    const maxEnrollmentStr = formData.get("maxEnrollment") as string | null;

    if (!title || !description || !format || !interestArea || !learningOutcomes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const maxEnrollment = maxEnrollmentStr ? parseInt(maxEnrollmentStr) : null;

    const proposal = await prisma.courseProposal.create({
      data: {
        proposedById: session.user.id,
        title: title.trim(),
        description: description.trim(),
        format: format as any,
        level: level as any || null,
        interestArea: interestArea.trim(),
        targetAudience: targetAudience?.trim() || null,
        prerequisites: prerequisites?.trim() || null,
        learningOutcomes: learningOutcomes.trim(),
        resources: resources?.trim() || null,
        maxEnrollment,
        status: "PENDING"
      }
    });

    return NextResponse.redirect(new URL("/courses/propose", request.url));
  } catch (error) {
    console.error("Error creating course proposal:", error);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }
}
