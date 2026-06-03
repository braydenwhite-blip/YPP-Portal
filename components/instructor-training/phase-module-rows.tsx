"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import type { TaskRow, TaskRowStatus } from "@/lib/training-phases";
import styles from "./training-academy.module.css";

/* ------------------------------------------------------------------
   Module rows for ONE phase. Extracted from the old cluster list so the
   phase map can reuse it. The current module opens by default; only one
   row is open at a time. Each row routes into the journey player
   (`/training/{id}`) — this component never renders the journey itself.

   Reliability fixes vs the old list:
   - A locked row that has an unlocking destination always renders that
     action (never a hidden dead-end button).
   - The launch lift only fires for internal navigations.
   ------------------------------------------------------------------ */

function Chevron() {
  return (
    <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function Lock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function stateClass(status: TaskRowStatus): string {
  switch (status) {
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

export default function PhaseModuleRows({
  modules,
  initialOpenId = null,
  justCompletedId = null,
}: {
  modules: TaskRow[];
  initialOpenId?: string | null;
  justCompletedId?: string | null;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const launch = (event: MouseEvent<HTMLAnchorElement>, mod: TaskRow) => {
    if (!mod.href) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || mod.href.startsWith("http")) return;
    event.preventDefault();
    setLaunchingId(mod.id);
    window.setTimeout(() => router.push(mod.href as string), 200);
  };

  return (
    <ol className={styles.list}>
      {modules.map((mod, modIdx) => {
        const isOpen = openId === mod.id;
        const isLocked = mod.status === "locked";
        const positionNumber = modIdx + 1;
        const justChecked = mod.id === justCompletedId && mod.status === "complete";

        return (
          <li
            key={mod.id}
            className={`${styles.item} ${stateClass(mod.status)} ${
              launchingId === mod.id ? styles.rowLaunching : ""
            }`}
          >
            <button
              type="button"
              className={`${styles.row} ${isOpen ? styles.rowOpen : ""}`}
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : mod.id)}
            >
              <span
                className={`${styles.marker} ${justChecked ? styles.markerJustChecked : ""}`}
                aria-hidden
              >
                {mod.status === "complete" ? <CheckMark /> : isLocked ? <Lock /> : positionNumber}
              </span>

              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{mod.title}</span>
                <span className={styles.rowMeta}>
                  {mod.isCapstone ? <span className={styles.capstoneTag}>Capstone</span> : null}
                  {mod.statusLabel ? (
                    <span className={`${styles.rowStatusPill} ${mod.statusDone ? styles.isDone : ""}`}>
                      {mod.statusLabel}
                    </span>
                  ) : null}
                  {mod.estimatedMinutes ? <span>{mod.estimatedMinutes} min</span> : null}
                </span>
              </span>

              <span className={styles.rowAside}>
                {mod.status === "complete"
                  ? "Done"
                  : mod.status === "current"
                    ? "In progress"
                    : isLocked
                      ? "Locked"
                      : "Up next"}
                <Chevron />
              </span>
            </button>

            <div className={`${styles.body} ${isOpen ? styles.bodyOpen : ""}`}>
              <div className={styles.bodyInner}>
                <div className={styles.bodyContent}>
                  <p className={styles.bodyDesc}>{mod.description}</p>

                  {!isLocked && !mod.isCapstone ? (
                    <div className={styles.progressTrack}>
                      <span
                        className={styles.progressBar}
                        role="progressbar"
                        aria-valuenow={mod.progressPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${mod.title} progress`}
                      >
                        <span
                          className={`${styles.progressFill} ${mod.progressDone ? styles.isDone : ""}`}
                          style={{ width: `${mod.progressPct}%` }}
                        />
                      </span>
                      <span className={styles.progressValue}>{mod.progressPct}%</span>
                    </div>
                  ) : null}

                  {mod.configurationIssue ? (
                    <p className={styles.configNote} role="status">
                      {mod.configurationIssue}
                    </p>
                  ) : null}

                  {isLocked && mod.lockReason ? (
                    <p className={styles.lockNote}>{mod.lockReason}</p>
                  ) : null}

                  {/* Reliable CTA: render whenever there is a destination — even
                      for locked rows, so the unlocking step is always reachable. */}
                  {mod.href && mod.ctaLabel ? (
                    <div className={styles.bodyActions}>
                      <Link
                        href={mod.href}
                        className="button small"
                        style={{ textDecoration: "none" }}
                        onClick={(event) => launch(event, mod)}
                      >
                        {mod.ctaLabel}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
