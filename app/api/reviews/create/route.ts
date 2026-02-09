import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const courseId = formData.get("courseId") as string;
    const ratingStr = formData.get("rating") as string;
    const review = formData.get("review") as string | null;
    const isAnonymous = formData.get("isAnonymous") === "true";

    if (!courseId || !ratingStr) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rating = parseInt(ratingStr);

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    // Verify user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        courseId
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "You must be enrolled to review this course" }, { status: 403 });
    }

    // Check if user already reviewed
    const existingReview = await prisma.courseReview.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId: session.user.id
        }
      }
    });

    if (existingReview) {
      return NextResponse.json({ error: "You already reviewed this course" }, { status: 400 });
    }

    // Create the review
    await prisma.courseReview.create({
      data: {
        courseId,
        userId: session.user.id,
        rating,
        review: review?.trim() || null,
        isAnonymous
      }
    });

    return NextResponse.redirect(new URL(`/courses/${courseId}/reviews`, request.url));
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
