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
import { COHORT } from "@/lib/training-curriculum/cohort";

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
  /** When true, shows a "Who's in the room" panel with the recurring cohort
   *  before the start CTA. Used by the simulation-heavy modules. */
  showCohort?: boolean;
  /** YPP role-framework label, e.g. "GOAL 2" — shown as the GOAL accent. */
  goalBadge?: string | null;
  /** Instructor-column outcome line shown under the GOAL accent. */
  goalOutcome?: string | null;
  onStart: () => void;
};

const ARCHETYPE_EMOJI: Record<string, string> = {
  shy: "🫥",
  overconfident: "😎",
  distracted: "🌀",
  nervous: "😬",
  curious: "🤔",
  resistant: "😶",
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
  showCohort = false,
  goalBadge = null,
  goalOutcome = null,
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
        {goalBadge ? (
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--ypp-purple-600)",
            }}
          >
            {goalBadge}
          </p>
        ) : null}

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

        {goalOutcome ? (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.5,
              color: "var(--ypp-purple-700)",
            }}
          >
            {goalOutcome}
          </p>
        ) : null}

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

        {/* "Who's in the room" panel — recurring cohort, only shown when
            the journey is simulation-heavy. */}
        {showCohort && mode !== "review" ? (
          <div className="cohort-panel" aria-label="Students in this room">
            <p className="cohort-panel__label">Who&rsquo;s in the room</p>
            <ul className="cohort-panel__list">
              {COHORT.map((student) => (
                <li key={student.name} className="cohort-panel__item">
                  <span className="cohort-panel__avatar" aria-hidden="true">
                    {ARCHETYPE_EMOJI[student.archetype] ?? "🙂"}
                  </span>
                  <span className="cohort-panel__copy">
                    <span className="cohort-panel__name">{student.name}</span>
                    <span className="cohort-panel__thumb">{student.thumbnail}</span>
                  </span>
                </li>
              ))}
            </ul>
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
