"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import type { GoalNode } from "@/lib/training-phases";
import GoalBadge from "./goal-badge";
import styles from "./training-roadmap.module.css";

/* ------------------------------------------------------------------
   One node on the GOAL roadmap. Shows the GOAL label, title, the
   Instructor-column outcome, estimated time, a token-based state pill,
   and — once complete — an earned GoalBadge. Each card routes into the
   journey player (`/training/{id}`); a locked node still renders its
   unlocking action so the next step is never a dead end.
   ------------------------------------------------------------------ */

function Lock() {
  return (
    <svg className={styles.lockIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12.5 4 4L19 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function nodeStateClass(node: GoalNode): string {
  switch (node.state) {
    case "complete":
      return styles.isComplete;
    case "current":
      return styles.isCurrent;
    case "locked":
      return styles.isLocked;
    default:
      return styles.isUpcoming;
  }
}

function kindClass(node: GoalNode): string {
  if (node.kind === "capstone") return styles.isCapstoneNode;
  if (node.kind === "studio") return styles.isStudioNode;
  return "";
}

const STATE_LABEL: Record<GoalNode["state"], string> = {
  complete: "Done",
  current: "In progress",
  upcoming: "Up next",
  locked: "Locked",
};

export default function TrainingGoalCard({
  node,
  position,
  justChecked = false,
}: {
  node: GoalNode;
  /** 1-based marker number used when the node isn't complete/locked. */
  position: number;
  /** Animate the marker + badge in (node was just finished). */
  justChecked?: boolean;
}) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);

  const launch = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!node.href) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || node.href.startsWith("http")) return;
    event.preventDefault();
    setLaunching(true);
    window.setTimeout(() => router.push(node.href as string), 200);
  };

  const isLocked = node.state === "locked";
  const isComplete = node.state === "complete";
  const isCurrent = node.state === "current";

  // Numbered GOALs show their number ("1"…"5") on the earned badge; Welcome /
  // Capstone / Studio nodes earn a checkmark instead.
  const badgeLabel = node.countsTowardCoverage ? node.badge.replace(/[^0-9]/g, "") : null;

  return (
    <li
      id={`milestone-${node.id}`}
      className={`${styles.node} ${nodeStateClass(node)} ${kindClass(node)}`}
      aria-label={`${node.badge ? `${node.badge}: ` : ""}${node.title}`}
    >
      <span className={styles.spine} aria-hidden>
        <span className={`${styles.marker} ${justChecked ? styles.markerJustChecked : ""}`}>
          {isComplete ? <CheckMark /> : isLocked ? <Lock /> : position}
        </span>
      </span>

      <div className={`${styles.card} ${launching ? styles.cardLaunching : ""}`}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadText}>
            {node.badge ? <span className={styles.cardBadge}>{node.badge}</span> : null}
            <h3 className={styles.cardTitle}>{node.title}</h3>
            <p className={styles.cardOutcome}>{node.outcome}</p>
          </div>

          {isComplete ? (
            <GoalBadge label={badgeLabel} pop={justChecked} />
          ) : (
            <span
              className={`${styles.statePill} ${isCurrent ? styles.pillCurrent : ""}`}
            >
              {STATE_LABEL[node.state]}
            </span>
          )}
        </div>

        <div className={styles.cardMeta}>
          {node.estimatedMinutes ? (
            <span className={styles.metaChip}>{node.estimatedMinutes} min</span>
          ) : null}
          {isComplete && node.scorePct !== null ? (
            <span className={`${styles.statePill} ${styles.pillComplete}`}>
              Scored {node.scorePct}%
            </span>
          ) : null}
        </div>

        {isLocked && node.lockReason ? (
          <p className={styles.lockNote}>
            <Lock />
            {node.lockReason}
          </p>
        ) : null}

        {/* Reliable CTA: render whenever there's a destination — even for a
            locked node, so the unlocking step is always reachable. */}
        {node.href && node.ctaLabel ? (
          <div className={styles.cardActions}>
            <Link
              href={node.href}
              className="button small"
              style={{ textDecoration: "none" }}
              onClick={launch}
            >
              {node.ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}
