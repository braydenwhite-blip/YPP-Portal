import { NextRequest, NextResponse } from "next/server";
import { MentorshipType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyMentorWeeklyDigest } from "@/lib/mentorship-notifications";
import { tallyMentorDigests } from "@/lib/mentor-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUIET_DAYS = 21;

/**
 * Weekly cron that sends each mentor a single rolled-up digest of what their
 * mentoring week needs: reviews waiting on them, unscheduled kickoffs, and
 * mentees with no recent activity.
 *
 * Schedule (UTC): `0 13 * * 1` (Monday).
 * Auth: Vercel-to-route cron secret (CRON_SECRET header).
 *
 * Mentors with nothing outstanding are skipped — the digest never fires noise.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const weekKey = today.toISOString().slice(0, 10);
  const quietCutoff = new Date(today.getTime() - QUIET_DAYS * 24 * 60 * 60 * 1000);

  try {
    const mentorships = await prisma.mentorship.findMany({
      where: { status: "ACTIVE", type: { not: MentorshipType.STUDENT } },
      select: {
        mentorId: true,
        cycleStage: true,
        kickoffScheduledAt: true,
        sessions: {
          where: { scheduledAt: { gte: quietCutoff }, cancelledAt: null },
          select: { id: true },
          take: 1,
        },
        checkIns: {
          where: { createdAt: { gte: quietCutoff } },
          select: { id: true },
          take: 1,
        },
      },
    });

    const tallies = tallyMentorDigests(
      mentorships.map((m) => ({
        mentorId: m.mentorId,
        cycleStage: m.cycleStage,
        kickoffScheduledAt: m.kickoffScheduledAt,
        hasRecentSession: m.sessions.length > 0,
        hasRecentCheckIn: m.checkIns.length > 0,
      }))
    );

    let sent = 0;
    for (const tally of tallies) {
      const result = await notifyMentorWeeklyDigest({
        mentorId: tally.mentorId,
        weekKey,
        reviewsDue: tally.reviewsDue,
        kickoffsUnscheduled: tally.kickoffsUnscheduled,
        quietMentees: tally.quietMentees,
      });
      if (result) sent += 1;
    }

    logger.info({ mentors: tallies.length, sent, weekKey }, "mentor-weekly-digest cron");
    return NextResponse.json({ ok: true, mentors: tallies.length, sent, weekKey });
  } catch (err) {
    logger.error({ err }, "mentor-weekly-digest cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
