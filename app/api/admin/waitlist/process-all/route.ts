import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { processWaitlist } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all courses with active waitlists
  const waitlistEntries = await prisma.waitlistEntry.findMany({
    where: { status: "WAITING" },
    select: { courseId: true }
  });

  // Group by course and process
  const courseIds = [...new Set(waitlistEntries.map(e => e.courseId))];
  let totalProcessed = 0;

  for (const courseId of courseIds) {
    const offered = await processWaitlist(courseId);
    totalProcessed += offered ? 1 : 0;
  }

  redirect("/admin/waitlist?processed=" + totalProcessed);
}
