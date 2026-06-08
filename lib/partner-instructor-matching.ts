import type { InstructorLifecycleStage } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Partner → Instructor matching (Phase 4).
 *
 * Structured, explainable matching — NOT AI. We tokenize a partner's program
 * needs (requested subjects + age groups) and score active instructors by how
 * many of their tags (skill/interest/trait) overlap, with light bonuses for
 * readiness and leadership-track flags. Every match carries human-readable
 * reasons so an admin can trust (and override) the suggestion.
 *
 * This is intentionally a useful heuristic, not a perfect ranker (see the plan's
 * open questions). It reuses the existing instructor tag system — no new schema.
 */

// Teachable lifecycle stages worth surfacing for a partner need.
const MATCH_POOL_STAGES = ["ACTIVE", "ONBOARDING", "BENCH"] as const;

const STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "kids",
  "grade",
  "grades",
  "age",
  "ages",
  "group",
  "groups",
  "week",
  "weeks",
  "class",
  "classes",
  "program",
  "programs",
  "students",
  "student",
]);

/** Normalize free text into a set of meaningful tokens (≥3 chars, no stopwords). */
export function tokenizeNeeds(...parts: (string | null | undefined)[]): Set<string> {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length >= 3 && !STOPWORDS.has(raw)) tokens.add(raw);
    }
  }
  return tokens;
}

function tagTokens(label: string, slug: string): string[] {
  return [
    ...label.toLowerCase().split(/[^a-z0-9]+/),
    ...slug.toLowerCase().split(/[^a-z0-9]+/),
  ].filter((t) => t.length >= 3);
}

export type InstructorMatch = {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  lifecycleStage: string;
  isLeadershipTrack: boolean;
  readinessScore: number | null;
  matchedTags: string[];
  reasons: string[];
  score: number;
};

export type PartnerMatchResult = {
  needTokens: string[];
  matches: InstructorMatch[];
};

/**
 * Rank instructors against a partner's program needs.
 * Returns an empty `matches` list (with a populated `needTokens`) when there are
 * needs but no overlap, and an empty `needTokens` when no needs are recorded yet
 * — both let the UI show a precise, actionable empty state.
 */
export async function matchInstructorsForPartner(input: {
  requestedSubjects: string | null;
  requestedAgeGroups: string | null;
  limit?: number;
}): Promise<PartnerMatchResult> {
  const needs = tokenizeNeeds(input.requestedSubjects, input.requestedAgeGroups);
  if (needs.size === 0) {
    return { needTokens: [], matches: [] };
  }

  const profiles = await prisma.instructorProfile.findMany({
    where: {
      isOnHold: false,
      lifecycleStage: { in: MATCH_POOL_STAGES as unknown as InstructorLifecycleStage[] },
    },
    select: {
      id: true,
      userId: true,
      lifecycleStage: true,
      isLeadershipTrack: true,
      readinessScore: true,
      user: { select: { name: true, email: true } },
      tags: {
        select: { tag: { select: { label: true, slug: true, namespace: true } } },
      },
    },
    take: 400,
  });

  const matches: InstructorMatch[] = [];

  for (const p of profiles) {
    const matchedTags: string[] = [];
    let tagScore = 0;

    for (const t of p.tags) {
      const tokens = tagTokens(t.tag.label, t.tag.slug);
      const hit = tokens.some((tok) => needs.has(tok));
      if (hit) {
        matchedTags.push(t.tag.label);
        // Skill / interest tags are the strongest subject-fit signal.
        tagScore += t.tag.namespace === "SKILL" || t.tag.namespace === "INTEREST" ? 2 : 1;
      }
    }

    if (tagScore === 0) continue; // no subject overlap — skip

    const reasons: string[] = [];
    if (matchedTags.length > 0) {
      reasons.push(`Matches ${matchedTags.slice(0, 4).join(", ")}`);
    }
    if (p.lifecycleStage === "ACTIVE") reasons.push("Active instructor");
    if (p.isLeadershipTrack) reasons.push("Leadership track");

    let score = tagScore;
    if (p.lifecycleStage === "ACTIVE") score += 1;
    if (p.isLeadershipTrack) score += 1;
    if (typeof p.readinessScore === "number" && p.readinessScore >= 70) {
      score += 1;
      reasons.push("Strong readiness");
    }

    matches.push({
      profileId: p.id,
      userId: p.userId,
      name: p.user.name || p.user.email || "Instructor",
      email: p.user.email || "",
      lifecycleStage: p.lifecycleStage,
      isLeadershipTrack: p.isLeadershipTrack,
      readinessScore: p.readinessScore,
      matchedTags,
      reasons,
      score,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    needTokens: Array.from(needs),
    matches: matches.slice(0, input.limit ?? 12),
  };
}
