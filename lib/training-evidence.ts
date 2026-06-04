/**
 * Training evidence read-shape — aggregates an instructor's Instructor Academy
 * signals into one object that reviewer surfaces (admin / chapter-president
 * per-instructor readiness panels) render against the same 5 GOALS the rest of
 * the portal reviews against.
 *
 * Phase 6 (admin visibility): no new table. This derives entirely from existing
 * models — `TrainingAssignment`, `InteractiveJourneyCompletion`,
 * `InteractiveBeatAttempt`, and the Studio `CurriculumDraft.reviewRubric` — and
 * labels everything from `lib/training-goals.ts` so the wording never drifts.
 */

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  GOAL_KEYS,
  GOAL_META,
  goalBadge,
  type GoalKey,
} from "@/lib/training-goals";
import {
  normalizeReviewRubric,
  type StudioReviewRubric,
} from "@/lib/curriculum-draft-progress";

/** Per-GOAL completion + score for one instructor. */
export type GoalEvidence = {
  goalKey: GoalKey;
  /** Roadmap label, e.g. "GOAL 1" (empty for Welcome / Capstone). */
  badge: string;
  title: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  /** Interactive-journey score for the GOAL's module, 0–100, or null. */
  scorePct: number | null;
  /** Whether the journey was passed (null when ungraded / not attempted). */
  passed: boolean | null;
};

/**
 * A beat the learner repeatedly struggled with — a "topic to probe" a reviewer
 * can ask about. Derived from append-only beat attempts: a beat surfaces when
 * the learner never got it right, or needed several tries.
 */
export type TopicToProbe = {
  beatTitle: string;
  goalBadge: string;
  /** Highest attempt number recorded for this beat. */
  attempts: number;
  /** Whether the learner ever answered correctly. */
  everCorrect: boolean;
};

export type TrainingEvidence = {
  instructorId: string;
  goals: GoalEvidence[];
  topicsToProbe: TopicToProbe[];
  /** Latest Studio review rubric, with the draft status it came from. */
  studioRubric:
    | { status: string; rubric: StudioReviewRubric; submittedAt: string | null }
    | null;
  /** All numbered GOAL modules (1–5) complete. */
  academyComplete: boolean;
};

/** A beat counts as a "topic to probe" when the learner clearly struggled. */
const PROBE_MIN_ATTEMPTS = 3;
/** Cap the probe list so reviewer cards stay scannable. */
const MAX_TOPICS_TO_PROBE = 6;

type ModuleSnapshot = {
  id: string;
  goalKey: string | null;
  title: string;
  journeyId: string | null;
};

type AssignmentSnapshot = {
  userId: string;
  moduleId: string;
  status: string;
};

type CompletionSnapshot = {
  userId: string;
  journeyId: string;
  scorePct: number;
  passed: boolean;
};

type BeatAttemptSnapshot = {
  userId: string;
  beatTitle: string;
  goalKey: string | null;
  attemptNumber: number;
  correct: boolean;
};

type DraftSnapshot = {
  authorId: string;
  status: string;
  reviewRubric: unknown;
  submittedAt: string | null;
};

/**
 * Pure builder — turns flat snapshot rows into per-instructor evidence. Kept
 * separate from the Prisma query so it is trivially testable.
 */
export function buildTrainingEvidence(snapshot: {
  instructorIds: string[];
  modules: ModuleSnapshot[];
  assignments: AssignmentSnapshot[];
  completions: CompletionSnapshot[];
  beatAttempts: BeatAttemptSnapshot[];
  drafts: DraftSnapshot[];
}): Map<string, TrainingEvidence> {
  const { instructorIds, modules, assignments, completions, beatAttempts, drafts } =
    snapshot;

  // One module per numbered GOAL drives the roadmap; pick the first module for
  // each goalKey deterministically (curriculum authors keep this 1:1).
  const moduleByGoal = new Map<GoalKey, ModuleSnapshot>();
  for (const mod of modules) {
    if (!mod.goalKey) continue;
    const key = mod.goalKey as GoalKey;
    if (!GOAL_META[key]) continue;
    if (!moduleByGoal.has(key)) moduleByGoal.set(key, mod);
  }

  const assignmentByUserModule = new Map<string, AssignmentSnapshot>();
  for (const a of assignments) {
    assignmentByUserModule.set(`${a.userId}::${a.moduleId}`, a);
  }
  const completionByUserJourney = new Map<string, CompletionSnapshot>();
  for (const c of completions) {
    completionByUserJourney.set(`${c.userId}::${c.journeyId}`, c);
  }

  // Aggregate beat attempts per (user, beat title) → max attempt + ever correct.
  type ProbeAcc = { goalKey: string | null; attempts: number; everCorrect: boolean };
  const probeByUser = new Map<string, Map<string, ProbeAcc>>();
  for (const attempt of beatAttempts) {
    let perBeat = probeByUser.get(attempt.userId);
    if (!perBeat) {
      perBeat = new Map();
      probeByUser.set(attempt.userId, perBeat);
    }
    const existing = perBeat.get(attempt.beatTitle);
    if (existing) {
      existing.attempts = Math.max(existing.attempts, attempt.attemptNumber);
      existing.everCorrect = existing.everCorrect || attempt.correct;
    } else {
      perBeat.set(attempt.beatTitle, {
        goalKey: attempt.goalKey,
        attempts: attempt.attemptNumber,
        everCorrect: attempt.correct,
      });
    }
  }

  // Latest draft per author (drafts arrive ordered newest-first).
  const draftByAuthor = new Map<string, DraftSnapshot>();
  for (const d of drafts) {
    if (!draftByAuthor.has(d.authorId)) draftByAuthor.set(d.authorId, d);
  }

  const numberedGoals: GoalKey[] = GOAL_KEYS.filter(
    (k) => GOAL_META[k].badge !== ""
  );

  const result = new Map<string, TrainingEvidence>();
  for (const instructorId of instructorIds) {
    const goals: GoalEvidence[] = GOAL_KEYS.map((goalKey) => {
      const meta = GOAL_META[goalKey];
      const mod = moduleByGoal.get(goalKey);
      let status: GoalEvidence["status"] = "NOT_STARTED";
      let scorePct: number | null = null;
      let passed: boolean | null = null;

      if (mod) {
        const assignment = assignmentByUserModule.get(`${instructorId}::${mod.id}`);
        if (assignment?.status === "COMPLETE") status = "COMPLETE";
        else if (assignment && assignment.status !== "NOT_STARTED")
          status = "IN_PROGRESS";

        if (mod.journeyId) {
          const completion = completionByUserJourney.get(
            `${instructorId}::${mod.journeyId}`
          );
          if (completion) {
            scorePct = completion.scorePct;
            passed = completion.passed;
            if (status === "NOT_STARTED") status = "COMPLETE";
          }
        }
      }

      return {
        goalKey,
        badge: meta.badge,
        title: meta.title,
        status,
        scorePct,
        passed,
      };
    });

    const perBeat = probeByUser.get(instructorId);
    const topicsToProbe: TopicToProbe[] = perBeat
      ? Array.from(perBeat.entries())
          .filter(
            ([, acc]) => !acc.everCorrect || acc.attempts >= PROBE_MIN_ATTEMPTS
          )
          .map(([beatTitle, acc]) => ({
            beatTitle,
            goalBadge: goalBadge(acc.goalKey),
            attempts: acc.attempts,
            everCorrect: acc.everCorrect,
          }))
          .sort((a, b) => {
            // Never-correct first, then by attempt count, then stable by title.
            if (a.everCorrect !== b.everCorrect) return a.everCorrect ? 1 : -1;
            if (a.attempts !== b.attempts) return b.attempts - a.attempts;
            return a.beatTitle.localeCompare(b.beatTitle);
          })
          .slice(0, MAX_TOPICS_TO_PROBE)
      : [];

    const draft = draftByAuthor.get(instructorId);
    const studioRubric = draft
      ? {
          status: draft.status,
          rubric: normalizeReviewRubric(draft.reviewRubric),
          submittedAt: draft.submittedAt,
        }
      : null;

    const academyComplete = numberedGoals.every((goalKey) => {
      const g = goals.find((entry) => entry.goalKey === goalKey);
      return g?.status === "COMPLETE";
    });

    result.set(instructorId, {
      instructorId,
      goals,
      topicsToProbe,
      studioRubric,
      academyComplete,
    });
  }

  return result;
}

/**
 * Load per-GOAL training evidence for a set of instructors. Falls back to empty
 * evidence (never throws) so reviewer pages degrade gracefully if the DB is
 * unavailable.
 */
export async function getTrainingEvidenceMany(
  instructorIds: string[]
): Promise<Map<string, TrainingEvidence>> {
  const uniqueIds = Array.from(new Set(instructorIds)).filter(Boolean);
  if (uniqueIds.length === 0) return new Map();

  const data = await withPrismaFallback(
    "getTrainingEvidenceMany:queries",
    () =>
      Promise.all([
        prisma.trainingModule.findMany({
          where: { goalKey: { not: null } },
          select: {
            id: true,
            goalKey: true,
            title: true,
            interactiveJourney: { select: { id: true } },
          },
        }),
        prisma.trainingAssignment.findMany({
          where: { userId: { in: uniqueIds } },
          select: { userId: true, moduleId: true, status: true },
        }),
        prisma.interactiveJourneyCompletion.findMany({
          where: { userId: { in: uniqueIds } },
          select: { userId: true, journeyId: true, scorePct: true, passed: true },
        }),
        prisma.interactiveBeatAttempt.findMany({
          where: { userId: { in: uniqueIds } },
          select: {
            userId: true,
            attemptNumber: true,
            correct: true,
            beat: {
              select: {
                title: true,
                journey: {
                  select: { module: { select: { goalKey: true } } },
                },
              },
            },
          },
        }),
        prisma.curriculumDraft.findMany({
          where: {
            authorId: { in: uniqueIds },
            status: { in: ["SUBMITTED", "APPROVED", "NEEDS_REVISION", "REJECTED"] },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            authorId: true,
            status: true,
            reviewRubric: true,
            submittedAt: true,
          },
        }),
      ]),
    null
  );

  if (!data) {
    return buildTrainingEvidence({
      instructorIds: uniqueIds,
      modules: [],
      assignments: [],
      completions: [],
      beatAttempts: [],
      drafts: [],
    });
  }

  const [modules, assignments, completions, beatAttempts, drafts] = data;

  return buildTrainingEvidence({
    instructorIds: uniqueIds,
    modules: modules.map((m) => ({
      id: m.id,
      goalKey: m.goalKey,
      title: m.title,
      journeyId: m.interactiveJourney?.id ?? null,
    })),
    assignments,
    completions,
    beatAttempts: beatAttempts.map((a) => ({
      userId: a.userId,
      beatTitle: a.beat.title,
      goalKey: a.beat.journey.module.goalKey,
      attemptNumber: a.attemptNumber,
      correct: a.correct,
    })),
    drafts: drafts.map((d) => ({
      authorId: d.authorId,
      status: d.status,
      reviewRubric: d.reviewRubric,
      submittedAt: d.submittedAt?.toISOString() ?? null,
    })),
  });
}
