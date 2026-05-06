"use client";

/**
 * JourneyComplete — the post-journey celebration and summary screen.
 *
 * Shows:
 *   - Score summary (first-try correct count / visited beat count)
 *   - XP earned
 *   - Badge reveal with badgePop spring animation
 *   - ConfettiBurst (canvas particles, reduced-motion-safe)
 *   - Two CTAs: "Back to Academy" (primary) + "Start next module" (secondary)
 *   - After 4s idle, pulse the primary CTA once (disabled in reduced-motion)
 *
 * Reduced-motion: no badge spring (opacity fade), no CTA pulse.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import type { JourneyCompletionSummary } from "@/lib/training-journey/client-contracts";
import { DURATIONS, EASE } from "@/lib/training-journey/motion";
import { useJourneyMotion } from "./MotionProvider";
import { ConfettiBurst } from "./ConfettiBurst";

export type JourneyCompleteProps = {
  completion: JourneyCompletionSummary;
  title: string;
  backHref: string;
  nextModule: { id: string; title: string } | null;
  /**
   * When the just-completed module is the Readiness Check (M5), pass these so
   * the success screen surfaces the right capstone CTA. They are mutually
   * exclusive — the server picks one based on the applicant's subtype.
   */
  unlocksLessonDesignStudio?: boolean;
  unlocksWorkshopSubmission?: boolean;
};

export function JourneyComplete({
  completion,
  title,
  backHref,
  nextModule,
  unlocksLessonDesignStudio = false,
  unlocksWorkshopSubmission = false,
}: JourneyCompleteProps) {
  const { variants, reduced } = useJourneyMotion();

  // 4-second idle CTA pulse — fires once, not on a loop (plan §6)
  const [ctaPulsed, setCtaPulsed] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduced) return;
    idleTimerRef.current = setTimeout(() => setCtaPulsed(true), 4000);
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [reduced]);

  const badgeLabel = completion.badgeKey ?? "Completed";
  const firstTryCount = completion.firstTryCorrectCount;
  const totalBeats = completion.visitedBeatCount;

  // Pick a warm headline based on first-try ratio so the celebration screen
  // feels less canned. All variants stay within "good job" territory — we
  // don't punish a bumpier path.
  const ratio = totalBeats > 0 ? firstTryCount / totalBeats : 0;
  const headline =
    ratio >= 0.9
      ? "Smooth run."
      : ratio >= 0.6
      ? "Nicely done."
      : "That's a wrap.";

  const subline =
    ratio >= 0.9
      ? "You read the room and made the right calls. That instinct is what keeps a workshop alive."
      : ratio >= 0.6
      ? "Solid moves on most of these. Worth re-reading the ones you missed — they tend to repeat in the wild."
      : "You worked through every beat — that's the whole point. Skim the feedback and the patterns will start clicking.";

  // Badge animation: spring pop in full-motion, opacity fade in reduced-motion.
  const badgeVariants = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: DURATIONS.fast } },
      }
    : variants.badgePop;

  // CTA pulse: single scale tween at 4s if not in reduced-motion
  const ctaAnimateProps = !reduced && ctaPulsed
    ? {
        animate: { scale: [1, 1.03, 1] as number[] },
        transition: { duration: DURATIONS.moment, ease: EASE, times: [0, 0.5, 1] },
      }
    : {};

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Confetti — absolute positioned, full-bleed, pointer-events: none */}
      <ConfettiBurst />

      {/* Content card */}
      <motion.div
        className="card"
        variants={variants.fadeUp}
        initial="hidden"
        animate="visible"
        style={{
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Module title */}
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{title}</p>

        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: "var(--ypp-ink)" }}>
          {headline}
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary, #3d2f4d)" }}>
          {subline}
        </p>

        {/* Badge reveal (hero motion — one per screen, plan §6 Principle 3) */}
        <motion.div
          variants={badgeVariants}
          initial="initial"
          animate="animate"
          style={{
            display: "inline-block",
            background: "var(--ypp-purple-100)",
            color: "var(--ypp-purple-700)",
            borderRadius: 12,
            padding: "12px 24px",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.01em",
            marginBottom: 28,
          }}
        >
          🏅 {badgeLabel}
        </motion.div>

        {/* Score summary */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ypp-ink)" }}>
            Nailed <strong>{firstTryCount}</strong> of <strong>{totalBeats}</strong> on the first try
            {typeof completion.scorePct === "number" ? (
              <span style={{ color: "var(--muted)" }}> · {completion.scorePct}% score</span>
            ) : null}
          </p>
          <p style={{ margin: 0, fontSize: 15, color: "var(--ypp-purple)", fontWeight: 600 }}>
            +{completion.xpEarned} XP banked
          </p>
        </div>

        {/* What's next? — explicit guidance instead of leaving the user wondering */}
        {unlocksLessonDesignStudio || unlocksWorkshopSubmission || nextModule ? (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            {unlocksWorkshopSubmission ? (
              <>
                <strong style={{ color: "var(--ypp-purple)" }}>
                  Workshop submission is unlocked.
                </strong>{" "}
                Design your own workshop or pick one from the approved
                library next.
              </>
            ) : unlocksLessonDesignStudio ? (
              <>
                <strong style={{ color: "var(--ypp-purple)" }}>
                  Lesson Design Studio is unlocked.
                </strong>{" "}
                Build your capstone curriculum next.
              </>
            ) : (
              <>Next up: {nextModule!.title}.</>
            )}
          </p>
        ) : null}

        {/* CTAs — primary CTA leads forward, "Back to Academy" is the secondary action */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {unlocksWorkshopSubmission ? (
            <motion.div {...ctaAnimateProps}>
              <Link
                href="/instructor/workshop-design-studio"
                className="button"
                style={{ display: "block", textAlign: "center" }}
              >
                Open Workshop Design Studio
              </Link>
            </motion.div>
          ) : unlocksLessonDesignStudio ? (
            <motion.div {...ctaAnimateProps}>
              <Link
                href="/instructor/lesson-design-studio?entry=training"
                className="button"
                style={{ display: "block", textAlign: "center" }}
              >
                Open Lesson Design Studio
              </Link>
            </motion.div>
          ) : nextModule ? (
            <motion.div {...ctaAnimateProps}>
              <Link
                href={`/training/${nextModule.id}`}
                className="button"
                style={{ display: "block", textAlign: "center" }}
              >
                Start next module: {nextModule.title}
              </Link>
            </motion.div>
          ) : (
            <motion.div {...ctaAnimateProps}>
              <Link
                href={backHref}
                className="button"
                style={{ display: "block", textAlign: "center" }}
              >
                Back to Academy
              </Link>
            </motion.div>
          )}

          {(unlocksLessonDesignStudio || unlocksWorkshopSubmission || nextModule) && (
            <Link
              href={backHref}
              className="button secondary"
              style={{ display: "block", textAlign: "center" }}
            >
              Back to Academy
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
