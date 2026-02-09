import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { processWaitlist } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all courses with active waitlists
  const waitlistEntries = await prisma.courseWaitlist.findMany({
    where: { status: "WAITING" },
    include: {
      course: {
        include: {
          _count: {
            select: { enrollments: true }
          }
        }
      }
    },
    orderBy: { joinedAt: "asc" }
  });

  // Group by course and process
  const courseIds = [...new Set(waitlistEntries.map(e => e.courseId))];
  let totalProcessed = 0;

  for (const courseId of courseIds) {
    const processed = await processWaitlist(courseId);
    totalProcessed += processed;
  }

  redirect("/admin/waitlist?processed=" + totalProcessed);
}
