"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./training-academy.module.css";

/* ------------------------------------------------------------------
   Linear training list. The launchpad metaphor: one vertical path,
   grouped into three milestone clusters. The current module is
   highlighted and open; completed modules are checked; upcoming and
   gated modules are dimmed/locked. Only one module is open at a time.

   This component never renders the journey itself — each module
   ROUTES INTO the existing journey player (`/training/{id}`) and the
   player returns the instructor here with the step freshly checked.
   ------------------------------------------------------------------ */

export type ListModuleStatus = "complete" | "current" | "upcoming" | "locked";

export interface ListModule {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number | null;
  status: ListModuleStatus;
  /** Short status label (e.g. "Score 90%" or "3 / 8 beats"). */
  statusLabel: string | null;
  statusDone: boolean;
  progressPct: number;
  progressDone: boolean;
  href: string | null;
  ctaLabel: string | null;
  lockReason: string | null;
  configurationIssue: string | null;
  isCapstone: boolean;
}

export interface ModuleCluster {
  id: string;
  index: number;
  kicker: string;
  title: string;
  subtitle: string;
  complete: boolean;
  modules: ListModule[];
}

function Chevron() {
  return (
    <svg
      className={styles.chevron}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12.5 4 4L19 6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function stateClass(status: ListModuleStatus): string {
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

export default function TrainingModuleList({
  clusters,
  initialOpenId,
}: {
  clusters: ModuleCluster[];
  /** Module that should be expanded on first paint (usually the current one). */
  initialOpenId: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);

  return (
    <div className={styles.clusters}>
      {clusters.map((cluster, clusterIdx) => (
        <section
          key={cluster.id}
          id={`milestone-${cluster.id}`}
          className={`${styles.cluster} ${cluster.complete ? styles.isComplete : ""}`}
          aria-label={`Milestone ${clusterIdx + 1}: ${cluster.title}`}
        >
          <div className={styles.clusterHead}>
            <span className={styles.clusterKicker}>
              <span className={styles.clusterIndex}>
                {cluster.complete ? <CheckMark /> : cluster.index}
              </span>
              {cluster.kicker}
            </span>
            <h3 className={styles.clusterTitle}>{cluster.title}</h3>
            <p className={styles.clusterSubtitle}>{cluster.subtitle}</p>
          </div>

          <ol className={styles.list}>
            {cluster.modules.map((mod, modIdx) => {
              const isOpen = openId === mod.id;
              const isLocked = mod.status === "locked";
              const positionNumber = modIdx + 1;

              return (
                <li key={mod.id} className={`${styles.item} ${stateClass(mod.status)}`}>
                  <button
                    type="button"
                    className={`${styles.row} ${isOpen ? styles.rowOpen : ""}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : mod.id)}
                  >
                    <span className={styles.marker} aria-hidden>
                      {mod.status === "complete" ? (
                        <CheckMark />
                      ) : isLocked ? (
                        <Lock />
                      ) : (
                        positionNumber
                      )}
                    </span>

                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{mod.title}</span>
                      <span className={styles.rowMeta}>
                        {mod.isCapstone ? (
                          <span className={styles.capstoneTag}>Capstone</span>
                        ) : null}
                        {mod.statusLabel ? (
                          <span
                            className={`${styles.rowStatusPill} ${
                              mod.statusDone ? styles.isDone : ""
                            }`}
                          >
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
                                className={`${styles.progressFill} ${
                                  mod.progressDone ? styles.isDone : ""
                                }`}
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

                        {isLocked ? (
                          <p className={styles.lockNote}>
                            {mod.lockReason ?? "Complete the previous steps to unlock this."}
                          </p>
                        ) : null}

                        {mod.href && mod.ctaLabel ? (
                          <div className={styles.bodyActions}>
                            <Link href={mod.href} className="button small" style={{ textDecoration: "none" }}>
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
        </section>
      ))}
    </div>
  );
}
