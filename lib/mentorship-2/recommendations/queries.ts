/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — recommendation read helpers.
 *
 * Plain async functions (not `"use server"`) for Server Components and the data
 * layer. Reads only; all mutations live in actions.ts.
 */

import { prisma } from "@/lib/prisma";
import {
  type MentorshipApplicationStatus,
  type MentorshipRecommendationStatus,
} from "../constants";
import type { MentorCandidate, ScoreBreakdown } from "../matching/types";
import { toMentorCandidate } from "./inputs";

/** Count of a mentor's currently ACTIVE mentorships (their live workload). */
export async function getMentorLoad(mentorUserId: string): Promise<number> {
  return prisma.mentorship.count({
    where: { mentorId: mentorUserId, status: "ACTIVE" },
  });
}

/** Active load for many mentors in one grouped query (avoids N+1). */
export async function getMentorLoads(
  mentorIds: string[]
): Promise<Map<string, number>> {
  if (mentorIds.length === 0) return new Map();
  const grouped = await prisma.mentorship.groupBy({
    by: ["mentorId"],
    where: { mentorId: { in: mentorIds }, status: "ACTIVE" },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.mentorId, g._count._all]));
}

/**
 * The pool of users who can be recommended as mentors: anyone who has declared a
 * mentor signal (expertise, capacity) OR already mentors OR holds the MENTOR
 * role. Thin/empty profiles are intentionally included — the scorer ranks them
 * low via the completeness penalty rather than hiding them.
 */
export async function getEligibleMentors(opts?: {
  excludeUserId?: string;
}): Promise<MentorCandidate[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
      OR: [
        { mentorExpertise: { some: {} } },
        { profile: { mentorCapacity: { not: null } } },
        { mentorPairs: { some: { status: "ACTIVE" } } },
        { primaryRole: "MENTOR" },
        { roles: { some: { role: "MENTOR" } } },
      ],
    },
    select: {
      id: true,
      name: true,
      profile: { select: { mentorCapacity: true, mentorAvailability: true } },
      mentorExpertise: {
        select: {
          proficiency: true,
          expertiseArea: {
            select: { slug: true, name: true, category: true, isActive: true },
          },
        },
      },
    },
  });

  const loads = await getMentorLoads(users.map((u) => u.id));
  return users.map((u) => toMentorCandidate(u, loads.get(u.id) ?? 0));
}

/** A recommendation shaped for the admin matching-queue UI. */
export type RecommendationDTO = {
  id: string;
  status: MentorshipRecommendationStatus;
  score: number;
  breakdown: ScoreBreakdown;
  adminNote: string | null;
  mentorUserId: string;
  mentorName: string | null;
  mentorEmail: string;
  mentorExpertise: { slug: string; name: string; proficiency: string | null }[];
  mentorCapacity: number | null;
  mentorHasAvailability: boolean;
  mentorLoad: number;
  createdAt: string;
  decidedAt: string | null;
};

/** All recommendations for an application, score-ordered, shaped for the UI. */
export async function listRecommendationsForApplication(
  applicationId: string
): Promise<RecommendationDTO[]> {
  const recs = await prisma.mentorshipMatchRecommendation.findMany({
    where: { mentorshipApplicationId: applicationId },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          profile: { select: { mentorCapacity: true, mentorAvailability: true } },
          mentorExpertise: {
            select: {
              proficiency: true,
              expertiseArea: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ score: "desc" }, { mentorUserId: "asc" }],
  });

  const loads = await getMentorLoads(recs.map((r) => r.mentorUserId));

  return recs.map((r) => ({
    id: r.id,
    status: r.status as MentorshipRecommendationStatus,
    score: r.score,
    breakdown: (r.scoreBreakdownJson ?? {}) as unknown as ScoreBreakdown,
    adminNote: r.adminNote,
    mentorUserId: r.mentorUserId,
    mentorName: r.mentor?.name ?? null,
    mentorEmail: r.mentor?.email ?? "",
    mentorExpertise: (r.mentor?.mentorExpertise ?? []).map((me) => ({
      slug: me.expertiseArea.slug,
      name: me.expertiseArea.name,
      proficiency: me.proficiency,
    })),
    mentorCapacity: r.mentor?.profile?.mentorCapacity ?? null,
    mentorHasAvailability: Boolean(
      r.mentor?.profile?.mentorAvailability &&
        r.mentor.profile.mentorAvailability.trim()
    ),
    mentorLoad: loads.get(r.mentorUserId) ?? 0,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  }));
}

/** Whether an application already has any non-superseded recommendations. */
export async function applicationHasRecommendations(
  applicationId: string
): Promise<boolean> {
  const count = await prisma.mentorshipMatchRecommendation.count({
    where: {
      mentorshipApplicationId: applicationId,
      status: { not: "SUPERSEDED" },
    },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Matching queue — applications grouped by workflow stage
// ---------------------------------------------------------------------------

/** Workflow buckets the admin queue groups applications into. */
export type ApplicationQueueBucket =
  | "new"
  | "needsRecommendations"
  | "hasRecommendations"
  | "shortlisted"
  | "held"
  | "matched"
  | "closed";

export interface RecommendationSummary {
  suggested: number;
  shortlisted: number;
  held: number;
  approved: number;
  rejected: number;
  superseded: number;
  topScore: number | null;
}

function emptySummary(): RecommendationSummary {
  return {
    suggested: 0,
    shortlisted: 0,
    held: 0,
    approved: 0,
    rejected: 0,
    superseded: 0,
    topScore: null,
  };
}

/**
 * Map an application's status + its recommendation summary to a single queue
 * bucket. Pure (no I/O) so the grouping rule is obvious and unit-testable.
 */
export function bucketForApplication(
  status: string,
  s: RecommendationSummary
): ApplicationQueueBucket {
  if (status === "MATCHED" || s.approved > 0) return "matched";
  if (status === "DECLINED" || status === "WITHDRAWN") return "closed";
  // Open application (SUBMITTED / UNDER_REVIEW):
  if (s.shortlisted > 0) return "shortlisted";
  if (s.suggested > 0) return "hasRecommendations";
  if (s.held > 0) return "held";
  if (status === "SUBMITTED") return "new";
  return "needsRecommendations";
}

export interface ApplicationQueueItem {
  id: string;
  status: MentorshipApplicationStatus;
  bucket: ApplicationQueueBucket;
  applicantName: string | null;
  applicantEmail: string;
  goals: string | null;
  interestsCount: number;
  createdAt: string;
  summary: RecommendationSummary;
}

/** Every application with its recommendation summary + computed queue bucket. */
export async function getApplicationsQueue(): Promise<ApplicationQueueItem[]> {
  const applications = await prisma.mentorshipApplication.findMany({
    include: { applicant: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const [counts, maxScores] = await Promise.all([
    prisma.mentorshipMatchRecommendation.groupBy({
      by: ["mentorshipApplicationId", "status"],
      _count: { _all: true },
    }),
    prisma.mentorshipMatchRecommendation.groupBy({
      by: ["mentorshipApplicationId"],
      where: { status: { in: ["SUGGESTED", "SHORTLISTED", "HELD", "APPROVED"] } },
      _max: { score: true },
    }),
  ]);

  const summaryByApp = new Map<string, RecommendationSummary>();
  const summaryOf = (id: string) => {
    let cur = summaryByApp.get(id);
    if (!cur) {
      cur = emptySummary();
      summaryByApp.set(id, cur);
    }
    return cur;
  };
  for (const c of counts) {
    const cur = summaryOf(c.mentorshipApplicationId);
    const n = c._count._all;
    switch (c.status as MentorshipRecommendationStatus) {
      case "SUGGESTED": cur.suggested += n; break;
      case "SHORTLISTED": cur.shortlisted += n; break;
      case "HELD": cur.held += n; break;
      case "APPROVED": cur.approved += n; break;
      case "REJECTED": cur.rejected += n; break;
      case "SUPERSEDED": cur.superseded += n; break;
    }
  }
  for (const m of maxScores) {
    summaryOf(m.mentorshipApplicationId).topScore = m._max.score ?? null;
  }

  return applications.map((a) => {
    const summary = summaryByApp.get(a.id) ?? emptySummary();
    return {
      id: a.id,
      status: a.status as MentorshipApplicationStatus,
      bucket: bucketForApplication(a.status, summary),
      applicantName: a.applicant?.name ?? null,
      applicantEmail: a.applicant?.email ?? "",
      goals: a.goals,
      interestsCount: a.interests.length,
      createdAt: a.createdAt.toISOString(),
      summary,
    };
  });
}
