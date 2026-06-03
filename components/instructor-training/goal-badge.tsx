"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "./training-roadmap.module.css";

/**
 * GoalBadge — the small celebratory mark shown when a GOAL section is
 * complete. Renders the GOAL number (e.g. "1") for the five numbered GOALs,
 * or a checkmark for Welcome / Capstone / Studio nodes. Reduced-motion safe;
 * the entrance pop is suppressed for users who prefer reduced motion.
 */
export default function GoalBadge({
  label,
  pop = false,
}: {
  /** Short label, e.g. "1". Falls back to a checkmark when empty. */
  label?: string | null;
  /** Play the entrance pop (used when a node was just completed). */
  pop?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const showPop = pop && !reduced;

  return (
    <motion.span
      className={`${styles.goalBadge} ${showPop ? styles.goalBadgePop : ""}`}
      role="img"
      aria-label={label ? `GOAL ${label} complete` : "Section complete"}
      initial={showPop ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
    >
      {label ? (
        <span className={styles.goalBadgeLabel}>{label}</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m5 12.5 4 4L19 6.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </motion.span>
  );
}
