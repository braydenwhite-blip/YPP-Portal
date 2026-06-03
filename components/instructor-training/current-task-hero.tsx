"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { useState, type MouseEvent } from "react";
import type { CurrentTask } from "@/lib/training-phases";
import ParallaxLayer from "./parallax-layer";
import ProgressRing from "./progress-ring";
import styles from "./training-home.module.css";

const HUE_CLASS: Record<CurrentTask["hue"], string> = {
  purple: styles.huePurple,
  teal: styles.hueTeal,
  green: styles.hueGreen,
};

function minutesLabel(minutes: number | null): string | null {
  if (!minutes) return null;
  return `${minutes} min`;
}

export default function CurrentTaskHero({
  task,
  progressPct,
  progressLabel,
}: {
  task: CurrentTask;
  progressPct: number;
  progressLabel: string;
}) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const [launching, setLaunching] = useState(false);

  // Pointer-reactive depth orb — premium without motion noise. Disabled under
  // reduced motion (listener simply never moves the value).
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const ox = useSpring(px, { stiffness: 120, damping: 20 });
  const oy = useSpring(py, { stiffness: 120, damping: 20 });

  const onPointerMove = (event: MouseEvent<HTMLElement>) => {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = (event.clientX - rect.left) / rect.width - 0.5;
    const cy = (event.clientY - rect.top) / rect.height - 0.5;
    px.set(cx * 28);
    py.set(cy * 22);
  };
  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  // Forward "hero lift" — the card rises toward the journey player, then
  // navigates. Reduced motion / external nav skips straight to the link.
  const launch = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!task.href || reduced || task.href.startsWith("http")) return;
    event.preventDefault();
    setLaunching(true);
    window.setTimeout(() => router.push(task.href as string), 200);
  };

  const isDone = task.kind === "done";
  const timeChip = minutesLabel(task.estimatedMinutes);
  const ctaVerb = task.inProgress ? "Resume" : task.ctaLabel;

  return (
    <section
      className={`${styles.hero} ${HUE_CLASS[task.hue]} ${launching ? styles.heroLaunching : ""}`}
      onMouseMove={onPointerMove}
      onMouseLeave={onPointerLeave}
      aria-labelledby="training-current-task"
    >
      {/* Layered depth: a scroll-parallax field + a pointer-reactive orb. */}
      <ParallaxLayer className={styles.heroParallax} depth={42}>
        <span className={styles.heroOrbFar} />
      </ParallaxLayer>
      <motion.span
        className={styles.heroOrbNear}
        style={reduced ? undefined : { x: ox, y: oy }}
        aria-hidden
      />

      <div className={styles.heroBody}>
        <div className={styles.heroText}>
          <p className={styles.heroEyebrow}>
            {isDone ? "All phases complete" : `${task.phaseKicker} · ${task.phaseTitle}`}
          </p>
          <h2 id="training-current-task" className={styles.heroTitle}>
            {task.title}
          </h2>
          <p className={styles.heroDesc}>{task.description}</p>

          {task.configurationIssue ? (
            <p className={styles.heroNote} role="status">
              We&apos;re finishing setting this module up. You can open it now or move
              on — it won&apos;t block your progress.
            </p>
          ) : null}

          {task.blocked ? (
            <div className={styles.heroBlocked} role="status">
              <span className={styles.heroLockIcon} aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span>{task.blocked.reason}</span>
            </div>
          ) : null}

          <div className={styles.heroActions}>
            {task.blocked ? (
              task.blocked.unlockHref ? (
                <Link href={task.blocked.unlockHref} className="btn btn-primary">
                  {task.blocked.unlockLabel ?? "Open the unlocking step"} →
                </Link>
              ) : (
                <span className={styles.heroHint}>
                  This unlocks automatically once the previous step is done.
                </span>
              )
            ) : task.href ? (
              <Link href={task.href} className="btn btn-primary" onClick={launch}>
                {ctaVerb} →
              </Link>
            ) : null}

            {timeChip && !isDone ? (
              <span className={styles.heroTimeChip}>{timeChip}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.heroAside}>
          <ProgressRing
            pct={progressPct}
            label={progressLabel}
            complete={isDone}
            size={84}
          />
        </div>
      </div>
    </section>
  );
}
