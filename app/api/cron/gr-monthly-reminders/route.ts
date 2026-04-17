import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  notifyMenteeReflectionDue,
  notifyMentorReviewDue,
  notifyChairApprovalBatch,
  notifyMenteeReviewReleased,
} from "@/lib/mentorship-notifications";
import { getChairsForLane } from "@/lib/mentorship-chair-access";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cron for G&R cycle reminders + auto-archive.
 *
 * Schedule (UTC): `0 9 * * *`
 * Auth: Vercel-to-route cron secret (CRON_SECRET header).
 *
 * Day windows use the calendar day of the current UTC month:
 *   Day 25 → mentee reflection-due reminder (if not yet submitted)
 *   Day 28 → mentor review-due reminder (if reflection submitted but no review)
 *   Day 2  → chair batch reminder (pending reviews) + mentee release notifications
 *
 * A `testDay` query param (admin-only) overrides the calendar day for local smoke-testing.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret — require it unconditionally; 503 if misconfigured
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // testDay param only works outside production
  const testDayParam = req.nextUrl.searchParams.get("testDay");
  if (testDayParam && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "testDay not allowed in production" }, { status: 400 });
  }

  const today = new Date();
  const calDay = testDayParam ? parseInt(testDayParam, 10) : today.getUTCDate();

  // Current cycle month = first day of this UTC month
  const cycleMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const cycleMonthIso = cycleMonth.toISOString();

  const results: Record<string, number> = { day: calDay };

  try {
    // ── Day 25: mentee reflection-due reminders ─────────────────────────────
    if (calDay === 25) {
      // Suppress for mentorships created after day 7 of the current cycle month —
      // they haven't had enough time yet and would be spammed on first month.
      const cutoff = new Date(cycleMonth.getTime() + 7 * 24 * 60 * 60 * 1000);
      const mentorships = await prisma.mentorship.findMany({
        where: { status: "ACTIVE", startDate: { lte: cutoff } },
        select: {
          menteeId: true,
          selfReflections: {
            where: { cycleMonth: { gte: cycleMonth } },
            select: { id: true },
            take: 1,
          },
        },
      });

      let sent = 0;
      for (const m of mentorships) {
        if (m.selfReflections.length === 0) {
          await notifyMenteeReflectionDue({ menteeId: m.menteeId, cycleMonthIso });
          sent++;
        }
      }
      results.reflectionDueReminders = sent;
      logger.info({ sent, cycleMonthIso }, "gr-cron: day-25 reflection reminders");
    }

    // ── Day 28: mentor review-due reminders ─────────────────────────────────
    if (calDay === 28) {
      const mentorships = await prisma.mentorship.findMany({
        where: { status: "ACTIVE" },
        select: {
          mentorId: true,
          menteeId: true,
          mentee: { select: { name: true } },
          selfReflections: {
            where: { cycleMonth: { gte: cycleMonth } },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              goalReview: { select: { id: true, status: true } },
            },
          },
        },
      });

      let sent = 0;
      for (const m of mentorships) {
        const reflection = m.selfReflections[0];
        // Fire reminder if no review exists OR if a DRAFT review exists (mentor started but didn't submit)
        if (reflection && (!reflection.goalReview || reflection.goalReview.status === "DRAFT")) {
          await notifyMentorReviewDue({
            mentorId: m.mentorId,
            menteeId: m.menteeId,
            menteeName: m.mentee.name ?? "Mentee",
            cycleMonthIso,
          });
          sent++;
        }
      }
      results.reviewDueReminders = sent;
      logger.info({ sent, cycleMonthIso }, "gr-cron: day-28 review reminders");
    }

    // ── Day 2: chair batch reminders + mentee release notifications ──────────
    if (calDay === 2) {
      // Chair batch notifications
      const pendingReviews = await prisma.mentorGoalReview.findMany({
        where: { status: "PENDING_CHAIR_APPROVAL" },
        select: { id: true, mentee: { select: { primaryRole: true } } },
      });

      // Group by role type → find chairs → send one batched notification per chair
      const chairPendingCount = new Map<string, number>();
      for (const review of pendingReviews) {
        const roleType = toMenteeRoleType(review.mentee.primaryRole ?? "");
        if (!roleType) continue;
        const chairs = await getChairsForLane(roleType);
        for (const chair of chairs) {
          chairPendingCount.set(chair.id, (chairPendingCount.get(chair.id) ?? 0) + 1);
        }
      }
      for (const [chairId, count] of chairPendingCount) {
        await notifyChairApprovalBatch({ chairId, pendingCount: count, cycleMonthIso });
      }
      results.chairBatchNotifications = chairPendingCount.size;

      // Mentee release notifications (reviews approved since yesterday that haven't notified yet)
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const recentlyReleased = await prisma.mentorGoalReview.findMany({
        where: {
          status: "APPROVED",
          releasedToMenteeAt: { gte: yesterday },
        },
        select: {
          id: true,
          menteeId: true,
          cycleMonth: true,
        },
      });
      for (const review of recentlyReleased) {
        // Skip if the emitReviewApprovedAndReleased path already sent this notification
        const windowStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const alreadySent = await prisma.notification.findFirst({
          where: {
            dedupeKey: { in: [
              `review-released-mentee:${review.id}`,
              `gr:review-released:${review.menteeId}:${review.id}`,
            ]},
            createdAt: { gte: windowStart },
          },
          select: { id: true },
        });
        if (alreadySent) continue;

        await notifyMenteeReviewReleased({
          menteeId: review.menteeId,
          reviewId: review.id,
          cycleMonthIso: review.cycleMonth.toISOString(),
        });
      }
      results.menteeReleaseNotifications = recentlyReleased.length;
      logger.info({ chairCount: chairPendingCount.size, released: recentlyReleased.length }, "gr-cron: day-2 notifications");
    }

    // ── Auto-archive: completed goals older than 60 days ────────────────────
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const archived = await prisma.gRDocumentGoal.updateMany({
      where: {
        lifecycleStatus: "COMPLETED",
        completedAt: { lte: sixtyDaysAgo },
      },
      data: { lifecycleStatus: "ARCHIVED" },
    });
    results.autoArchived = archived.count;
    if (archived.count > 0) {
      logger.info({ count: archived.count }, "gr-cron: auto-archived completed goals");
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    logger.error({ err }, "gr-monthly-reminders cron failed");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
