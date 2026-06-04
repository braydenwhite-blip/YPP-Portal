/**
 * Training phase view-model (server-safe, pure).
 *
 * Turns the per-module cards the training page already computes into a
 * guided three-phase journey ("Run a Great Session" → "Prove You're Ready"
 * → "Design Your Lessons") with a single, always-actionable current task and
 * one next-task preview.
 *
 * Membership is by ROLE, not list index, so the number of craft modules can
 * grow from 3 to 13 without overflowing a phase or reintroducing the "wall of
 * tasks": everything that is not the Readiness Check or the capstone is Phase
 * 1. Only `READINESS_CHECK_MODULE_KEY` and `LESSON_DESIGN_STUDIO_MODULE_KEY`
 * (from `lib/training-constants.ts`) are referenced.
 *
 * This module is imported by both a server component (the training page) and
 * client components (the mission-control UI), so it must stay free of React
 * and browser globals.
 */

import { READINESS_CHECK_MODULE_KEY } from "@/lib/training-constants";
import { GOAL_META, goalBadge, type GoalKey } from "@/lib/training-goals";

export type PhaseId = "deliver" | "prove" | "design";
export type PhaseState = "complete" | "current" | "locked";
export type PhaseHue = "purple" | "teal" | "green";

export type TaskRowStatus = "complete" | "current" | "upcoming" | "locked";

/** A single module row inside a phase. Mirrors the legacy `ListModule`. */
export interface TaskRow {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number | null;
  status: TaskRowStatus;
  /** Short status label (e.g. "Score 90%"). */
  statusLabel: string | null;
  statusDone: boolean;
  progressPct: number;
  progressDone: boolean;
  href: string | null;
  ctaLabel: string | null;
  lockReason: string | null;
  configurationIssue: string | null;
  isCapstone: boolean;
  /** YPP role-framework key (WELCOME | GOAL_1…5 | CAPSTONE) — drives the roadmap. */
  goalKey: string | null;
  /** Instructor-column one-liner shown on the roadmap card. */
  outcomeStatement: string | null;
  /** Latest interactive-journey score, when scored. */
  scorePct: number | null;
}

/**
 * One node on the GOAL roadmap — the GOAL-mirrored replacement for the old
 * three-phase map. Each section of the Academy (Welcome, GOAL 1–5, the
 * Readiness Check capstone, and the Lesson Design Studio) is one node, in
 * sequence. Vocabulary comes from `lib/training-goals.ts` so the roadmap
 * never drifts from the official role framework.
 */
export type GoalNodeKind = "welcome" | "goal" | "capstone" | "studio";

export interface GoalNode {
  /** Stable id used for the rail anchor (`milestone-<id>`). */
  id: string;
  /** Role-framework key or `STUDIO` for the final design node. */
  key: GoalKey | "STUDIO";
  kind: GoalNodeKind;
  /** Roadmap label, e.g. "GOAL 2" / "Welcome" / "Capstone". */
  badge: string;
  title: string;
  /** Instructor-column outcome line. */
  outcome: string;
  estimatedMinutes: number | null;
  state: TaskRowStatus;
  scorePct: number | null;
  progressPct: number;
  href: string | null;
  ctaLabel: string | null;
  lockReason: string | null;
  /** True for the five numbered GOALs — feeds the "5-GOAL coverage" meter. */
  countsTowardCoverage: boolean;
}

export interface GoalCoverage {
  completed: number;
  total: number;
}

export interface PhaseView {
  id: PhaseId;
  index: number;
  kicker: string;
  title: string;
  subtitle: string;
  /** Motivational "what you'll be able to do" line. */
  outcome: string;
  state: PhaseState;
  hue: PhaseHue;
  /** One-liner shown when the phase is collapsed (complete or locked). */
  summary: string;
  modules: TaskRow[];
}

export interface CurrentTask {
  kind: "module" | "capstone" | "approval" | "done";
  phaseId: PhaseId | null;
  phaseKicker: string;
  phaseTitle: string;
  hue: PhaseHue;
  moduleId: string | null;
  title: string;
  description: string;
  /** Always present — never an empty/no-op label. */
  ctaLabel: string;
  /** Null only when `blocked` carries its own unlocking action instead. */
  href: string | null;
  estimatedMinutes: number | null;
  progressPct: number;
  /** Drives "Resume where you left off" wording. */
  inProgress: boolean;
  blocked: { reason: string; unlockHref: string | null; unlockLabel: string | null } | null;
  configurationIssue: string | null;
}

export interface NextTaskPreview {
  title: string;
  phaseKicker: string;
  estimatedMinutes: number | null;
}

export interface TrainingProgress {
  pct: number;
  completedModules: number;
  totalModules: number;
  trainingComplete: boolean;
  /** Estimated minutes left across incomplete modules, when known. */
  minutesRemaining: number | null;
}

export interface TrainingHomeModel {
  progress: TrainingProgress;
  currentTask: CurrentTask;
  nextTask: NextTaskPreview | null;
  phases: PhaseView[];
  activePhaseIndex: number;
  /** GOAL-mirrored roadmap nodes, in sequence (Welcome → G1–5 → Capstone → Studio). */
  goals: GoalNode[];
  /** Index of the first not-yet-complete roadmap node (for the rail). */
  activeGoalIndex: number;
  /** Completed numbered GOALs out of five — the coverage meter. */
  goalCoverage: GoalCoverage;
  subtype: "STANDARD" | "SUMMER_WORKSHOP";
  readinessHref: string;
}

/** Structural shape of the per-module cards the page already computes. */
export interface PhaseModuleCard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  module: { id: string; title: string; description: string; contentKey: string | null } & Record<string, any>;
  assignment?: { status: string } | undefined;
  fullyComplete: boolean;
  progressPct: number;
  configurationIssue: string | null;
  estimatedMinutes: number | null;
  journeyProgress: { isInteractive: boolean; scorePct: number | null };
}

interface PhaseMeta {
  id: PhaseId;
  index: number;
  title: string;
  subtitle: string;
  outcome: string;
  hue: PhaseHue;
}

const PHASE_META: Record<PhaseId, PhaseMeta> = {
  deliver: {
    id: "deliver",
    index: 1,
    title: "Run a Great Session",
    subtitle: "Plan and run sessions students keep coming back to.",
    outcome: "You'll be ready to lead a class with confidence.",
    hue: "purple",
  },
  prove: {
    id: "prove",
    index: 2,
    title: "Prove You're Ready",
    subtitle: "Show your skills, then book your curriculum review.",
    outcome: "You'll prove you're ready and schedule your review.",
    hue: "teal",
  },
  design: {
    id: "design",
    index: 3,
    title: "Design Your Lessons",
    subtitle: "Build your first lessons and get approved to teach.",
    outcome: "You'll design your curriculum and earn offering approval.",
    hue: "green",
  },
};

const PHASE_ORDER: PhaseId[] = ["deliver", "prove", "design"];

function rowStatusLabel(card: PhaseModuleCard): string | null {
  if (card.fullyComplete) return "Complete";
  if (card.journeyProgress.isInteractive && card.journeyProgress.scorePct !== null) {
    return `Score ${card.journeyProgress.scorePct}%`;
  }
  return null;
}

function defaultCta(card: PhaseModuleCard): string {
  if (card.fullyComplete) return "Review";
  if (card.assignment?.status === "IN_PROGRESS") return "Continue";
  return "Start module";
}

function toRow(
  card: PhaseModuleCard,
  status: TaskRowStatus,
  opts?: {
    isCapstone?: boolean;
    href?: string | null;
    ctaLabel?: string | null;
    lockReason?: string | null;
  },
): TaskRow {
  return {
    id: card.module.id,
    title: card.module.title,
    description: card.module.description,
    estimatedMinutes: card.estimatedMinutes,
    status,
    statusLabel: rowStatusLabel(card),
    statusDone: card.fullyComplete,
    progressPct: card.progressPct,
    progressDone: card.fullyComplete,
    href: opts?.href !== undefined ? opts.href : `/training/${card.module.id}`,
    ctaLabel: opts?.ctaLabel !== undefined ? opts.ctaLabel : defaultCta(card),
    lockReason: opts?.lockReason ?? null,
    configurationIssue: card.configurationIssue,
    isCapstone: opts?.isCapstone ?? false,
    goalKey: (card.module.goalKey as string | null | undefined) ?? null,
    outcomeStatement:
      (card.module.outcomeStatement as string | null | undefined) ?? null,
    scorePct: card.journeyProgress.scorePct,
  };
}

/**
 * Derive the GOAL roadmap from the ordered task rows. One node per section,
 * in sequence: Welcome → GOAL 1–5 → Readiness Check (capstone) → Lesson
 * Design Studio (or the Summer Workshop submission). The Studio/workshop row
 * carries no `goalKey`, so it's labelled from its `kind` rather than
 * `GOAL_META`.
 */
function buildGoalNodes(orderedRows: TaskRow[]): GoalNode[] {
  return orderedRows.map((row) => {
    const goalKey = row.goalKey as GoalKey | null;
    const meta = goalKey ? GOAL_META[goalKey] : undefined;

    let kind: GoalNodeKind;
    let key: GoalNode["key"];
    let badge: string;
    let outcome: string;

    if (meta) {
      key = goalKey as GoalKey;
      kind = goalKey === "WELCOME" ? "welcome" : goalKey === "CAPSTONE" ? "capstone" : "goal";
      badge = goalBadge(goalKey) || (kind === "welcome" ? "Welcome" : "Capstone");
      outcome = row.outcomeStatement || meta.outcome;
    } else if (row.isCapstone) {
      // Lesson Design Studio / Summer Workshop submission — the final node.
      key = "STUDIO";
      kind = "studio";
      badge = "Capstone";
      outcome =
        row.outcomeStatement ||
        "Design your first lessons and earn approval to teach.";
    } else {
      // Defensive fallback for any unframed legacy module.
      key = "STUDIO";
      kind = "goal";
      badge = "";
      outcome = row.outcomeStatement || row.description;
    }

    return {
      id: row.id,
      key,
      kind,
      badge,
      title: row.title,
      outcome,
      estimatedMinutes: row.estimatedMinutes,
      state: row.status,
      scorePct: row.scorePct,
      progressPct: row.progressPct,
      href: row.href,
      ctaLabel: row.ctaLabel,
      lockReason: row.lockReason,
      countsTowardCoverage: kind === "goal" && Boolean(meta),
    };
  });
}

interface BuildPhasesInput {
  /** All module cards except the Lesson Design Studio capstone, in sort order. */
  academyCards: PhaseModuleCard[];
  /** The capstone card, or null (e.g. Summer Workshop instructors). */
  ldsCard: PhaseModuleCard | null;
  readiness: {
    trainingComplete: boolean;
    academyModulesComplete: boolean;
    studioCapstoneComplete: boolean;
    canRequestOfferingApproval: boolean;
    completedRequiredModules: number;
    requiredModulesCount: number;
    nextAction: { title: string; detail: string; href: string };
  };
  /** Capstone gate satisfied (Readiness Check passed). */
  readinessCheckPassed: boolean;
  /** The Readiness Check module id, for the unlock link when capstone is locked. */
  readinessCheckModuleId: string | null;
  isSummerWorkshop: boolean;
  /** Where the Curriculum Review / Offering Approval operations now live. */
  readinessHref: string;
  trainingPct: number;
}

export function buildTrainingPhases(input: BuildPhasesInput): TrainingHomeModel {
  const {
    academyCards,
    ldsCard,
    readiness,
    readinessCheckPassed,
    readinessCheckModuleId,
    isSummerWorkshop,
    readinessHref,
    trainingPct,
  } = input;

  // ---- Academy rows: one global "current" (first incomplete), rest checked
  // or upcoming — same semantics the launchpad already used. -----------------
  const firstIncompleteIdx = academyCards.findIndex((c) => !c.fullyComplete);
  const academyRows = academyCards.map((card, idx) => {
    const status: TaskRowStatus = card.fullyComplete
      ? "complete"
      : idx === firstIncompleteIdx
        ? "current"
        : "upcoming";
    return { card, row: toRow(card, status) };
  });

  const deliverRows = academyRows
    .filter((e) => e.card.module.contentKey !== READINESS_CHECK_MODULE_KEY)
    .map((e) => e.row);
  const proveRows = academyRows
    .filter((e) => e.card.module.contentKey === READINESS_CHECK_MODULE_KEY)
    .map((e) => e.row);

  // ---- Phase 3: capstone (standard) or workshop submission (summer). --------
  const designRows: TaskRow[] = [];
  if (ldsCard) {
    designRows.push(
      readinessCheckPassed
        ? toRow(ldsCard, ldsCard.fullyComplete ? "complete" : "current", {
            isCapstone: true,
            href: "/instructor/lesson-design-studio?entry=training",
            ctaLabel: ldsCard.fullyComplete ? "Review studio" : "Open Studio",
          })
        : toRow(ldsCard, "locked", {
            isCapstone: true,
            href: readinessCheckModuleId ? `/training/${readinessCheckModuleId}` : null,
            ctaLabel: readinessCheckModuleId ? "Open Readiness Check" : null,
            lockReason: "Complete the Readiness Check to unlock the Lesson Design Studio.",
          }),
    );
  } else if (isSummerWorkshop) {
    const done = readiness.studioCapstoneComplete;
    designRows.push({
      id: "workshop-submission",
      title: "Submit your workshop",
      description:
        "Design or pick a workshop in the Workshop Design Studio and submit it for review.",
      estimatedMinutes: null,
      status: done ? "complete" : readinessCheckPassed ? "current" : "locked",
      statusLabel: done ? "Complete" : null,
      statusDone: done,
      progressPct: done ? 100 : 0,
      progressDone: done,
      href: readinessCheckPassed ? "/instructor/workshop-design-studio" : null,
      ctaLabel: readinessCheckPassed ? "Open Workshop Studio" : null,
      lockReason: readinessCheckPassed
        ? null
        : "Complete the Readiness Check to unlock the Workshop Design Studio.",
      configurationIssue: null,
      isCapstone: true,
      goalKey: null,
      outcomeStatement: null,
      scorePct: null,
    });
  }

  const rowsByPhase: Record<PhaseId, TaskRow[]> = {
    deliver: deliverRows,
    prove: proveRows,
    design: designRows,
  };

  // ---- Phase state: first non-complete phase is current. An empty phase
  // (e.g. a missing Readiness Check module) counts as complete so it can never
  // silently block the journey. ---------------------------------------------
  const phaseComplete = (rows: TaskRow[]) =>
    rows.length === 0 || rows.every((r) => r.status === "complete");

  let activePhaseIndex = PHASE_ORDER.findIndex((id) => !phaseComplete(rowsByPhase[id]));
  if (activePhaseIndex === -1) activePhaseIndex = PHASE_ORDER.length - 1;

  const phases: PhaseView[] = PHASE_ORDER.map((id, idx) => {
    const meta = PHASE_META[id];
    const rows = rowsByPhase[id];
    const state: PhaseState =
      idx < activePhaseIndex ? "complete" : idx === activePhaseIndex ? "current" : "locked";

    // Future phases read as locked so they never feel actionable yet.
    const displayRows =
      state === "locked"
        ? rows.map((r) =>
            r.status === "complete"
              ? r
              : {
                  ...r,
                  status: "locked" as TaskRowStatus,
                  lockReason:
                    r.lockReason ?? `Finish ${PHASE_META[PHASE_ORDER[idx - 1]].title} to unlock.`,
                },
          )
        : rows;

    const completeCount = rows.filter((r) => r.status === "complete").length;
    const summary =
      state === "complete"
        ? rows.length === 0
          ? "Done"
          : `${rows.length} ${rows.length === 1 ? "step" : "steps"} done`
        : state === "locked"
          ? `Unlocks after ${PHASE_META[PHASE_ORDER[Math.max(0, idx - 1)]].title}`
          : `${completeCount} of ${rows.length} done`;

    return {
      id,
      index: meta.index,
      kicker: `Phase ${meta.index}`,
      title: meta.title,
      subtitle: meta.subtitle,
      outcome: meta.outcome,
      state,
      hue: meta.hue,
      summary,
      modules: displayRows,
    };
  });

  // ---- The single current task: always actionable, never a dead end. --------
  const currentTask = pickCurrentTask({
    phases,
    activePhaseIndex,
    readiness,
    readinessHref,
    readinessCheckModuleId,
  });

  // ---- Next task preview: the next incomplete row after the current one. ----
  const orderedRows = phases.flatMap((p) =>
    p.modules.map((row) => ({ phase: p, row })),
  );
  const currentIdx = orderedRows.findIndex(
    (e) => e.row.id === currentTask.moduleId,
  );
  const nextEntry = orderedRows
    .slice(currentIdx + 1)
    .find((e) => e.row.status !== "complete");
  const nextTask: NextTaskPreview | null = nextEntry
    ? {
        title: nextEntry.row.title,
        phaseKicker: nextEntry.phase.kicker,
        estimatedMinutes: nextEntry.row.estimatedMinutes,
      }
    : null;

  // ---- Progress + time-to-ready momentum framing. ---------------------------
  const allRows = orderedRows.map((e) => e.row);
  const totalModules = allRows.length;
  const completedModules = allRows.filter((r) => r.status === "complete").length;
  const remainingMinutes = allRows
    .filter((r) => r.status !== "complete" && r.estimatedMinutes)
    .reduce((sum, r) => sum + (r.estimatedMinutes ?? 0), 0);

  // ---- GOAL roadmap: the GOAL-mirrored view that replaces the phase map. -----
  const goals = buildGoalNodes(allRows);
  const firstIncompleteGoal = goals.findIndex((g) => g.state !== "complete");
  const activeGoalIndex = firstIncompleteGoal === -1 ? Math.max(0, goals.length - 1) : firstIncompleteGoal;
  const coverageNodes = goals.filter((g) => g.countsTowardCoverage);
  const goalCoverage: GoalCoverage = {
    completed: coverageNodes.filter((g) => g.state === "complete").length,
    total: coverageNodes.length,
  };

  // Relabel the current/next task framing from "Phase N" to the GOAL the
  // module belongs to, so the hero and "Next up" speak the role framework.
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const currentGoal = currentTask.moduleId ? goalById.get(currentTask.moduleId) : undefined;
  if (currentGoal) {
    currentTask.phaseKicker = currentGoal.badge || "Academy";
    currentTask.phaseTitle = currentGoal.title;
  } else if (currentTask.kind === "approval") {
    currentTask.phaseKicker = "Almost there";
    currentTask.phaseTitle = "Get approved to teach";
  }
  if (nextTask) {
    const nextGoal = nextEntry ? goalById.get(nextEntry.row.id) : undefined;
    if (nextGoal) nextTask.phaseKicker = nextGoal.badge || "Up next";
  }

  return {
    progress: {
      pct: trainingPct,
      completedModules,
      totalModules,
      trainingComplete: readiness.trainingComplete,
      minutesRemaining: remainingMinutes > 0 ? remainingMinutes : null,
    },
    currentTask,
    nextTask,
    phases,
    activePhaseIndex,
    goals,
    activeGoalIndex,
    goalCoverage,
    subtype: isSummerWorkshop ? "SUMMER_WORKSHOP" : "STANDARD",
    readinessHref,
  };
}

function pickCurrentTask({
  phases,
  activePhaseIndex,
  readiness,
  readinessHref,
  readinessCheckModuleId,
}: {
  phases: PhaseView[];
  activePhaseIndex: number;
  readiness: BuildPhasesInput["readiness"];
  readinessHref: string;
  readinessCheckModuleId: string | null;
}): CurrentTask {
  if (readiness.trainingComplete) {
    return {
      kind: "done",
      phaseId: null,
      phaseKicker: "Complete",
      phaseTitle: "Training complete",
      hue: "green",
      moduleId: null,
      title: "You're cleared to teach",
      description:
        "Every phase is done. Your dashboard is where you'll plan sessions, log attendance, and connect with your students.",
      ctaLabel: "Go to your dashboard",
      href: "/",
      estimatedMinutes: null,
      progressPct: 100,
      inProgress: false,
      blocked: null,
      configurationIssue: null,
    };
  }

  const phase = phases[activePhaseIndex];

  // Prefer an actionable, fully-configured, unlocked row in the current phase.
  const actionable = phase.modules.find(
    (m) =>
      m.status !== "complete" &&
      m.status !== "locked" &&
      !m.configurationIssue &&
      m.href,
  );
  if (actionable) {
    return {
      kind: actionable.isCapstone ? "capstone" : "module",
      phaseId: phase.id,
      phaseKicker: phase.kicker,
      phaseTitle: phase.title,
      hue: phase.hue,
      moduleId: actionable.id,
      title: actionable.title,
      description: actionable.description,
      ctaLabel: actionable.ctaLabel ?? "Start",
      href: actionable.href,
      estimatedMinutes: actionable.estimatedMinutes,
      progressPct: actionable.progressPct,
      inProgress: actionable.progressPct > 0 && !actionable.statusDone,
      blocked: null,
      configurationIssue: null,
    };
  }

  // A locked row (e.g. capstone gated by the Readiness Check) → show the reason
  // AND the unlocking action, never a dead button.
  const locked = phase.modules.find((m) => m.status === "locked");
  if (locked) {
    const unlockHref =
      locked.href ??
      (readinessCheckModuleId ? `/training/${readinessCheckModuleId}` : readinessHref);
    return {
      kind: locked.isCapstone ? "capstone" : "module",
      phaseId: phase.id,
      phaseKicker: phase.kicker,
      phaseTitle: phase.title,
      hue: phase.hue,
      moduleId: locked.id,
      title: locked.title,
      description: locked.description,
      ctaLabel: locked.ctaLabel ?? "Open the next step",
      href: null,
      estimatedMinutes: locked.estimatedMinutes,
      progressPct: locked.progressPct,
      inProgress: false,
      blocked: {
        reason: locked.lockReason ?? "Finish the previous step to unlock this.",
        unlockHref,
        unlockLabel: locked.ctaLabel ?? "Open the unlocking step",
      },
      configurationIssue: null,
    };
  }

  // Only a misconfigured module remains — surface it without hard-blocking.
  const configRow = phase.modules.find((m) => m.configurationIssue);
  if (configRow) {
    return {
      kind: "module",
      phaseId: phase.id,
      phaseKicker: phase.kicker,
      phaseTitle: phase.title,
      hue: phase.hue,
      moduleId: configRow.id,
      title: configRow.title,
      description: configRow.description,
      ctaLabel: "View module",
      href: configRow.href,
      estimatedMinutes: configRow.estimatedMinutes,
      progressPct: configRow.progressPct,
      inProgress: false,
      blocked: null,
      configurationIssue: configRow.configurationIssue,
    };
  }

  // Academy + capstone done but readiness/approval still pending → send them to
  // the Readiness page where the curriculum review + approval now live.
  return {
    kind: "approval",
    phaseId: phase.id,
    phaseKicker: phase.kicker,
    phaseTitle: phase.title,
    hue: phase.hue,
    moduleId: null,
    title: readiness.canRequestOfferingApproval
      ? "Request your offering approval"
      : "Book your curriculum review",
    description: readiness.nextAction.detail,
    ctaLabel: "Go to Readiness",
    href: readinessHref,
    estimatedMinutes: null,
    progressPct: 100,
    inProgress: false,
    blocked: null,
    configurationIssue: null,
  };
}
