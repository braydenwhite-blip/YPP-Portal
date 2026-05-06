"use client";

/**
 * JourneyIntro — the landing screen shown before a journey begins.
 *
 * Rendered by the journey shell for all three states:
 *   - "start"   → first time; no prior attempts
 *   - "resume"  → in-progress journey (attempts exist, no completion row)
 *   - "review"  → journey already completed; user is revisiting
 *
 * Single `fadeUp` enter animation on mount (plan §6, hero motion per screen).
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { useJourneyMotion } from "./MotionProvider";

export type JourneyIntroProps = {
  title: string;
  description: string;
  estimatedMinutes: number;
  beatCount: number;
  backHref: string;
  backLabel?: string;
  mode: "start" | "resume" | "review";
  strictMode?: boolean;
  passScorePct?: number;
  onStart: () => void;
};

const CTA_LABEL: Record<JourneyIntroProps["mode"], string> = {
  start: "Let's begin",
  resume: "Pick up where you left off",
  review: "Walk through it again",
};

const SUB_COPY: Record<JourneyIntroProps["mode"], string | null> = {
  start: "Quick scenarios, real classroom moments. No long lectures.",
  resume: "Same module, same progress. Welcome back.",
  review: null,
};

export function JourneyIntro({
  title,
  description,
  estimatedMinutes,
  beatCount,
  backHref,
  backLabel = "Academy",
  mode,
  strictMode = false,
  passScorePct,
  onStart,
}: JourneyIntroProps) {
  const { variants } = useJourneyMotion();

  return (
    <div className="journey-intro" style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px" }}>
      {/* Back link */}
      <Link
        href={backHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: "var(--muted)",
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        ← {backLabel}
      </Link>

      {/* Hero card — single fadeUp animation on mount */}
      <motion.div
        className="card"
        variants={variants.fadeUp}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--ypp-ink)",
          }}
        >
          {title}
        </h1>

        <p style={{ margin: "0 0 20px", lineHeight: 1.65, color: "var(--muted)" }}>
          {description}
        </p>

        {/* Info chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: strictMode ? 16 : 28 }}>
          <span className="pill pill-purple" style={{ fontSize: 13 }}>
            {estimatedMinutes} min
          </span>
          <span className="pill pill-purple" style={{ fontSize: 13 }}>
            {beatCount} {beatCount === 1 ? "activity" : "activities"}
          </span>
          {typeof passScorePct === "number" ? (
            <span className="pill pill-purple" style={{ fontSize: 13 }}>
              {passScorePct}% to pass
            </span>
          ) : null}
          {strictMode ? (
            <span
              className="pill pill-small"
              style={{
                fontSize: 13,
                background: "#fef3c7",
                color: "#92400e",
                border: "1px solid #fcd34d",
              }}
            >
              Strict mode · one attempt per activity
            </span>
          ) : null}
        </div>

        {/* Strict-mode explainer — only shown for high-stakes journeys */}
        {strictMode && mode === "start" ? (
          <div
            role="status"
            style={{
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 20,
              fontSize: 13,
              color: "#78350f",
              lineHeight: 1.55,
            }}
          >
            <strong>Heads up — this one counts.</strong> Your first answer on
            each beat is the one we score, so don&rsquo;t rush. There&rsquo;s
            no time pressure; think it through.
          </div>
        ) : null}

        {/* CTA */}
        <button
          className="button"
          onClick={onStart}
          style={{ width: "100%" }}
        >
          {CTA_LABEL[mode]}
        </button>

        {SUB_COPY[mode] ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            {SUB_COPY[mode]}
          </p>
        ) : null}

        {mode === "review" ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
            Already cleared this one — feel free to revisit any beat.
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
