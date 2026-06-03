"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import type { TrainingHomeModel } from "@/lib/training-phases";
import CurrentTaskHero from "./current-task-hero";
import PhaseMap from "./phase-map";
import styles from "./training-home.module.css";

/**
 * Mission control for instructor training. Shows ONE current task (hero), ONE
 * next-task preview, an overall progress ring, and a compact three-phase map.
 * Used both inside the onboarding launchpad (Step 3) and on the standalone
 * training page, so onboarding and training read as one system.
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
  const { progress, currentTask, nextTask, phases, readinessHref } = model;

  // Phase-complete celebration: fire once, only when the module we just
  // returned from finished its phase. Keyed off the `?from=` return param the
  // server passes through — never on a plain revisit.
  const justCompletedPhase = justCompletedId
    ? phases.find(
        (p) => p.state === "complete" && p.modules.some((m) => m.id === justCompletedId),
      )
    : undefined;
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const showCelebration = Boolean(justCompletedPhase) && !celebrationDismissed;

  const progressLabel = `${progress.completedModules} / ${progress.totalModules}`;

  return (
    <div className={styles.home}>
      {bannersSlot}

      <AnimatePresence>
        {showCelebration && justCompletedPhase ? (
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
              <strong>{justCompletedPhase.kicker} cleared.</strong> {justCompletedPhase.outcome}
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
            <span className={styles.nextTitle}>
              {progress.trainingComplete ? "You're all done" : "Get approved to teach"}
            </span>
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

      <PhaseMap
        phases={phases}
        currentOpenId={currentTask.moduleId}
        justCompletedId={justCompletedId}
      />

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
