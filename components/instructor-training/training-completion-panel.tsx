"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { INSTRUCTOR_LADDER, ROLE_MISSION } from "@/lib/training-goals";
import styles from "./training-completion.module.css";

/**
 * TrainingCompletionPanel — the full-completion state on the Academy hub.
 * Names the role mission back to the instructor and introduces the promotion
 * ladder ("You're an Instructor. Here's the path to Senior."). The official
 * ladder is the motivation, per the redesign plan — no whimsical tiers, no
 * P/G/Y/R rating. Reduced-motion safe.
 */
export default function TrainingCompletionPanel({
  dashboardHref = "/",
}: {
  dashboardHref?: string;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.section
      className={styles.panel}
      role="status"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={styles.eyebrow}>Academy complete · 5 GOALS</span>
      <h2 className={styles.title}>You&rsquo;re a YPP Instructor.</h2>
      <p className={styles.mission}>{ROLE_MISSION}</p>

      <div className={styles.ladder}>
        <span className={styles.ladderLabel}>Where this goes</span>
        <ol className={styles.ladderList}>
          {INSTRUCTOR_LADDER.map((step, idx) => (
            <li
              key={step.key}
              className={`${styles.ladderStep} ${idx === 0 ? styles.ladderStepNow : ""}`}
            >
              <span className={styles.ladderTitle}>
                {step.title}
                {idx === 0 ? <span className={styles.ladderYouAreHere}>You&rsquo;re here</span> : null}
              </span>
              {step.promotionWindow ? (
                <span className={styles.ladderWindow}>{step.promotionWindow}</span>
              ) : null}
              <span className={styles.ladderSummary}>{step.summary}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.actions}>
        <Link href={dashboardHref} className="button" style={{ textDecoration: "none" }}>
          Go to your dashboard
        </Link>
      </div>
    </motion.section>
  );
}
