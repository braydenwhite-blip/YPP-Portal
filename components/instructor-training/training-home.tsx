"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import type { TrainingHomeModel } from "@/lib/training-phases";
import CurrentTaskHero from "./current-task-hero";
import TrainingGoalRoadmap from "./training-goal-roadmap";
import TrainingCompletionPanel from "./training-completion-panel";
import roadmap from "./training-roadmap.module.css";
import styles from "./training-home.module.css";

/**
 * Mission control for the Instructor Academy. Shows ONE current task (hero), a
 * next-task preview, an overall progress ring, a 5-GOAL coverage meter, and
 * the GOAL roadmap (Welcome → GOAL 1–5 → Readiness Check → Lesson Design
 * Studio). Used both inside the onboarding launchpad (Step 3) and on the
 * standalone training page, so onboarding and training read as one Academy.
 */
export default function TrainingHome({
  model,
  justCompletedId = null,
  bannersSlot,
}: {
  model: TrainingHomeModel;
  /** Module the instructor just returned from (drives the celebration + check). */
  justCompletedId?: string | null;
  /** Server-rendered status banners (Links only), shown above the hero. */
  bannersSlot?: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const { progress, currentTask, nextTask, goals, goalCoverage, readinessHref } = model;

  // GOAL-complete celebration: fire once, only when the node we just returned
  // from is complete. Keyed off the `?from=` return param the server passes
  // through — never on a plain revisit.
  const justCompletedGoal = justCompletedId
    ? goals.find((g) => g.id === justCompletedId && g.state === "complete")
    : undefined;
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const showCelebration = Boolean(justCompletedGoal) && !celebrationDismissed;

  const progressLabel = `${progress.completedModules} / ${progress.totalModules}`;

  return (
    <div className={styles.home}>
      {bannersSlot}

      <AnimatePresence>
        {showCelebration && justCompletedGoal ? (
          <motion.div
            className={styles.celebration}
            role="status"
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.celebrationDot} aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="m5 12.5 4 4L19 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className={styles.celebrationText}>
              <strong>
                {justCompletedGoal.badge ? `${justCompletedGoal.badge} ` : ""}
                {justCompletedGoal.title} complete.
              </strong>{" "}
              {justCompletedGoal.outcome}
            </span>
            <button
              type="button"
              className={styles.celebrationClose}
              aria-label="Dismiss"
              onClick={() => setCelebrationDismissed(true)}
            >
              ×
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {progress.trainingComplete ? (
        <TrainingCompletionPanel dashboardHref="/" />
      ) : (
        <>
          <CurrentTaskHero
            task={currentTask}
            progressPct={progress.pct}
            progressLabel={progressLabel}
          />

          <div className={styles.glanceRow}>
            {nextTask ? (
              <div className={styles.nextCard}>
                <span className={styles.nextLabel}>Next up</span>
                <span className={styles.nextTitle}>{nextTask.title}</span>
                <span className={styles.nextMeta}>
                  {nextTask.phaseKicker}
                  {nextTask.estimatedMinutes ? ` · ${nextTask.estimatedMinutes} min` : ""}
                </span>
              </div>
            ) : (
              <div className={styles.nextCard}>
                <span className={styles.nextLabel}>Next up</span>
                <span className={styles.nextTitle}>Get approved to teach</span>
                <span className={styles.nextMeta}>Curriculum review &amp; offering approval</span>
              </div>
            )}

            {progress.minutesRemaining ? (
              <div className={styles.momentumCard}>
                <span className={styles.momentumValue}>~{progress.minutesRemaining} min</span>
                <span className={styles.momentumLabel}>to teach-ready</span>
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* 5-GOAL coverage meter — how many of the five GOALs you've built. */}
      {goalCoverage.total > 0 ? (
        <div className={roadmap.coverage}>
          <div className={roadmap.coverageHead}>
            <span className={roadmap.coverageLabel}>5-GOAL coverage</span>
            <span className={roadmap.coverageCount}>
              {goalCoverage.completed} of {goalCoverage.total} goals
            </span>
          </div>
          <div className={roadmap.coverageDots} aria-hidden>
            {Array.from({ length: goalCoverage.total }).map((_, i) => (
              <span
                key={i}
                className={`${roadmap.coverageDot} ${
                  i < goalCoverage.completed ? roadmap.coverageDotOn : ""
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <TrainingGoalRoadmap goals={goals} justCompletedId={justCompletedId} />

      <Link href={readinessHref} className={styles.readinessLink}>
        <span>
          <strong>Curriculum review &amp; offering approval</strong>
          <span className={styles.readinessLinkSub}>
            Schedule your review, request approval, and find your certificate.
          </span>
        </span>
        <span aria-hidden className={styles.readinessArrow}>
          →
        </span>
      </Link>
    </div>
  );
}
