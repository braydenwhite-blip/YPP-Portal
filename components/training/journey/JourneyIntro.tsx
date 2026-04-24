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
  mode: "start" | "resume" | "review";
  onStart: () => void;
};

const CTA_LABEL: Record<JourneyIntroProps["mode"], string> = {
  start: "Start",
  resume: "Resume",
  review: "Review",
};

export function JourneyIntro({
  title,
  description,
  estimatedMinutes,
  beatCount,
  backHref,
  mode,
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
        ← Academy
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          <span className="pill pill-purple" style={{ fontSize: 13 }}>
            {estimatedMinutes} min
          </span>
          <span className="pill pill-purple" style={{ fontSize: 13 }}>
            {beatCount} {beatCount === 1 ? "activity" : "activities"}
          </span>
        </div>

        {/* CTA */}
        <button
          className="button"
          onClick={onStart}
          style={{ width: "100%" }}
        >
          {CTA_LABEL[mode]}
        </button>
      </motion.div>
    </div>
  );
}
