import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendChairDigestEmail } from "@/lib/email";
import { getChairQueue } from "@/lib/instructor-applicant-board-queries";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pendingApps = await getChairQueue({ scope: "admin" });

  if (pendingApps.length === 0) {
    return NextResponse.json({ sent: 0, reason: "No pending applications in chair queue." });
  }

  // Notify all ADMIN and HIRING_CHAIR users
  const chairs = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { in: ["ADMIN", "HIRING_CHAIR"] },
        },
      },
    },
    select: { id: true, email: true, name: true },
  });

  const summary = {
    count: pendingApps.length,
    oldest: pendingApps.reduce(
      (min, a) =>
        a.chairQueuedAt && (!min || a.chairQueuedAt < min) ? a.chairQueuedAt : min,
      null as Date | null
    ),
  };

  let sent = 0;
  for (const chair of chairs) {
    try {
      await sendChairDigestEmail(chair.id, summary);
      sent++;
    } catch (err) {
      console.error(`[chair-digest] Failed to send to ${chair.email}:`, err);
    }
  }

  return NextResponse.json({ sent, total: chairs.length, pendingApps: pendingApps.length });
}
