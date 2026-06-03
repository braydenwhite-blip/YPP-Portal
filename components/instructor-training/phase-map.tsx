"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { PhaseView } from "@/lib/training-phases";
import PhaseModuleRows from "./phase-module-rows";
import styles from "./training-home.module.css";

const HUE_CLASS: Record<PhaseView["hue"], string> = {
  purple: styles.huePurple,
  teal: styles.hueTeal,
  green: styles.hueGreen,
};

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12.5 4 4L19 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Lock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PhaseRows({
  phase,
  currentOpenId,
  justCompletedId,
}: {
  phase: PhaseView;
  currentOpenId: string | null;
  justCompletedId: string | null;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      className={styles.phaseRows}
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={reduced ? {} : { opacity: 1, height: "auto" }}
      exit={reduced ? {} : { opacity: 0, height: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: "hidden" }}
    >
      <PhaseModuleRows
        modules={phase.modules}
        initialOpenId={phase.state === "current" ? currentOpenId : null}
        justCompletedId={justCompletedId}
      />
    </motion.div>
  );
}

export default function PhaseMap({
  phases,
  currentOpenId = null,
  justCompletedId = null,
}: {
  phases: PhaseView[];
  currentOpenId?: string | null;
  justCompletedId?: string | null;
}) {
  // Completed phases collapse to a one-liner but can be reopened to review.
  const [reviewing, setReviewing] = useState<string | null>(null);

  return (
    <div className={styles.phaseMap}>
      {phases.map((phase) => {
        const isCurrent = phase.state === "current";
        const isComplete = phase.state === "complete";
        const isLocked = phase.state === "locked";
        const open = isCurrent || reviewing === phase.id;

        return (
          <section
            key={phase.id}
            id={`milestone-${phase.id}`}
            className={`${styles.phase} ${HUE_CLASS[phase.hue]} ${
              isCurrent ? styles.isCurrentPhase : isComplete ? styles.isCompletePhase : styles.isLockedPhase
            }`}
            aria-label={`${phase.kicker}: ${phase.title}`}
          >
            <header className={styles.phaseHead}>
              <span className={styles.phaseBadge} aria-hidden>
                {isComplete ? <CheckMark /> : isLocked ? <Lock /> : phase.index}
              </span>
              <div className={styles.phaseHeadText}>
                <span className={styles.phaseKicker}>{phase.kicker}</span>
                <h3 className={styles.phaseTitle}>{phase.title}</h3>
                <p className={styles.phaseSubtitle}>
                  {isCurrent ? phase.outcome : phase.subtitle}
                </p>
              </div>
              <div className={styles.phaseStatus}>
                <span className={styles.phaseSummary}>{phase.summary}</span>
                {isComplete ? (
                  <button
                    type="button"
                    className={styles.phaseReviewBtn}
                    aria-expanded={open}
                    onClick={() => setReviewing(open ? null : phase.id)}
                  >
                    {open ? "Hide" : "Review"}
                  </button>
                ) : null}
              </div>
            </header>

            <AnimatePresence initial={false}>
              {open ? (
                <PhaseRows
                  key="rows"
                  phase={phase}
                  currentOpenId={currentOpenId}
                  justCompletedId={justCompletedId}
                />
              ) : null}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
