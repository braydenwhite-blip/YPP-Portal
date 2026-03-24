"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

// ============================================
// MENTOR EFFECTIVENESS SCORE
// 100-point scale:
//   40pts — Mentee Progress (avg rating trend over time)
//   20pts — Review Timeliness (% submitted within 7 days of reflection)
//   20pts — Engagement (session frequency + action item completion)
//   10pts — Retention (% of mentees still active)
//   10pts — Mentee Satisfaction (from quarterly feedback ratings)
// ============================================

export interface MentorEffectivenessScore {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  totalScore: number;
  breakdown: {
    menteeProgress: number;     // /40
    reviewTimeliness: number;   // /20
    engagement: number;         // /20
    retention: number;          // /10
    satisfaction: number;       // /10
  };
  activeMenteeCount: number;
  totalMenteeCount: number;
  avgMenteeRating: string | null;
  lastActiveAt: string | null;
}

async function requireAdminOrMentor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string } };
}

export async function getMentorEffectivenessScores(): Promise<MentorEffectivenessScore[]> {
  await requireAdminOrMentor();

  // Fetch all mentors with their mentorships and reviews
  const mentors = await prisma.user.findMany({
    where: {
      roles: { some: { role: { in: ["MENTOR", "CHAPTER_PRESIDENT"] } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      mentorPairs: {
        include: {
          mentee: { select: { id: true, name: true } },
          goalReviews: {
            select: {
              id: true,
              overallRating: true,
              cycleNumber: true,
              cycleMonth: true,
              status: true,
              chairApprovedAt: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { cycleNumber: "asc" },
          },
          selfReflections: {
            select: {
              id: true,
              cycleNumber: true,
              submittedAt: true,
              goalReview: {
                select: { id: true, createdAt: true },
              },
            },
            orderBy: { cycleNumber: "asc" },
          },
          sessions: {
            select: { id: true, scheduledAt: true, completedAt: true },
            where: { completedAt: { not: null } },
          },
        },
      },
    },
  });

  const scores: MentorEffectivenessScore[] = [];

  for (const mentor of mentors) {
    const mentorships = mentor.mentorPairs;
    if (mentorships.length === 0) continue;

    const activeMentorships = mentorships.filter((m) => m.status === "ACTIVE");
    const activeMenteeCount = activeMentorships.length;
    const totalMenteeCount = mentorships.length;

    // ---- 1. MENTEE PROGRESS (40pts) ----
    // Look at rating progression per mentee: improving trend = higher score
    const RATING_NUMERIC: Record<string, number> = {
      BEHIND_SCHEDULE: 0,
      GETTING_STARTED: 1,
      ACHIEVED: 2,
      ABOVE_AND_BEYOND: 3,
    };

    let progressScore = 0;
    let menteeRatingSum = 0;
    let menteeRatingCount = 0;
    let avgMenteeRating: string | null = null;

    for (const m of mentorships) {
      const approvedReviews = m.goalReviews
        .filter((r) => r.status === "APPROVED")
        .sort((a, b) => a.cycleNumber - b.cycleNumber);

      for (const r of approvedReviews) {
        menteeRatingSum += RATING_NUMERIC[r.overallRating] ?? 0;
        menteeRatingCount++;
      }

      if (approvedReviews.length >= 2) {
        const first = RATING_NUMERIC[approvedReviews[0].overallRating] ?? 0;
        const last = RATING_NUMERIC[approvedReviews[approvedReviews.length - 1].overallRating] ?? 0;
        if (last > first) progressScore += 40 / mentorships.length; // improving
        else if (last === first) progressScore += 25 / mentorships.length; // stable
        else progressScore += 10 / mentorships.length; // declining
      } else if (approvedReviews.length === 1) {
        const r = RATING_NUMERIC[approvedReviews[0].overallRating] ?? 0;
        progressScore += (r / 3) * (35 / mentorships.length);
      }
    }

    progressScore = Math.min(40, Math.round(progressScore));

    // Avg overall rating label
    if (menteeRatingCount > 0) {
      const avg = menteeRatingSum / menteeRatingCount;
      if (avg >= 2.5) avgMenteeRating = "ABOVE_AND_BEYOND";
      else if (avg >= 1.5) avgMenteeRating = "ACHIEVED";
      else if (avg >= 0.5) avgMenteeRating = "GETTING_STARTED";
      else avgMenteeRating = "BEHIND_SCHEDULE";
    }

    // ---- 2. REVIEW TIMELINESS (20pts) ----
    // % of reviews written within 7 days of mentee reflection submission
    let timelinessDenominator = 0;
    let timelinessNumerator = 0;

    for (const m of mentorships) {
      for (const reflection of m.selfReflections) {
        if (!reflection.goalReview) continue;
        timelinessDenominator++;
        const reviewCreatedAt = reflection.goalReview.createdAt;
        const reflectionSubmittedAt = reflection.submittedAt;
        const daysDiff =
          (reviewCreatedAt.getTime() - reflectionSubmittedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 7) timelinessNumerator++;
      }
    }

    const timelinessRate = timelinessDenominator > 0 ? timelinessNumerator / timelinessDenominator : 0;
    const timelinessScore = Math.round(timelinessRate * 20);

    // ---- 3. ENGAGEMENT (20pts) ----
    // Session frequency + action item completion rate
    const totalCompletedSessions = mentorships.reduce((sum, m) => sum + m.sessions.length, 0);
    const sessionScore = Math.min(10, Math.round((totalCompletedSessions / Math.max(1, totalMenteeCount)) * 2.5));

    const actionItems = await prisma.mentorshipActionItem.findMany({
      where: { mentorshipId: { in: mentorships.map((m) => m.id) } },
      select: { status: true },
    });
    const completedItems = actionItems.filter((a) => a.status === "COMPLETE").length;
    const actionItemRate = actionItems.length > 0 ? completedItems / actionItems.length : 0;
    const actionItemScore = Math.round(actionItemRate * 10);
    const engagementScore = Math.min(20, sessionScore + actionItemScore);

    // ---- 4. RETENTION (10pts) ----
    const retentionRate = totalMenteeCount > 0 ? activeMenteeCount / totalMenteeCount : 1;
    const retentionScore = Math.round(retentionRate * 10);

    // ---- 5. SATISFACTION (10pts) ----
    // From quarterly feedback responses (if any)
    const feedbackResponses = await prisma.quarterlyFeedbackResponse.findMany({
      where: {
        request: {
          mentorshipId: { in: mentorships.map((m) => m.id) },
        },
      },
      select: { overallRating: true },
    });

    let satisfactionScore = 5; // default neutral
    if (feedbackResponses.length > 0) {
      const avgFeedbackRating =
        feedbackResponses.reduce((sum, r) => sum + r.overallRating, 0) / feedbackResponses.length;
      satisfactionScore = Math.round((avgFeedbackRating / 5) * 10);
    }

    const totalScore =
      progressScore + timelinessScore + engagementScore + retentionScore + satisfactionScore;

    // Last active
    const lastReview = mentorships
      .flatMap((m) => m.goalReviews)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const lastActiveAt = lastReview?.updatedAt?.toISOString() ?? null;

    scores.push({
      mentorId: mentor.id,
      mentorName: mentor.name ?? "Unknown",
      mentorEmail: mentor.email ?? "",
      totalScore,
      breakdown: {
        menteeProgress: progressScore,
        reviewTimeliness: timelinessScore,
        engagement: engagementScore,
        retention: retentionScore,
        satisfaction: satisfactionScore,
      },
      activeMenteeCount,
      totalMenteeCount,
      avgMenteeRating,
      lastActiveAt,
    });
  }

  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

export async function getMentorEffectivenessScore(mentorId: string): Promise<MentorEffectivenessScore | null> {
  const scores = await getMentorEffectivenessScores();
  return scores.find((s) => s.mentorId === mentorId) ?? null;
}
