"use client";

/**
 * Shared Motion (framer-motion) primitives for the People Strategy / Action
 * Tracker surfaces.
 *
 * Why this exists:
 *  - `MotionArea` is the single wrapper every animated surface mounts at its
 *    root. It does two jobs:
 *      1. `LazyMotion` + `domAnimation` loads only the DOM animation feature
 *         bundle (~15kb) instead of the full `motion` runtime, and `strict`
 *         enforces that callers use the lightweight `m.*` components.
 *      2. `MotionConfig reducedMotion="user"` makes EVERY descendant respect
 *         the OS "Reduce motion" setting declaratively — transform/layout
 *         animations are dropped and only opacity is animated. No per-component
 *         `useReducedMotion()` branching required.
 *  - `FeedbackBanner` is the one animated piece reused across surfaces: inline
 *    success / error feedback that fades + lifts in and out.
 *
 * Callers import `m` and `AnimatePresence` from here (not from framer-motion
 * directly) so the `strict` LazyMotion contract is impossible to violate.
 */

import { LazyMotion, domAnimation, m, AnimatePresence, MotionConfig } from "framer-motion";

import { feedbackBannerVariants } from "@/lib/people-strategy/motion";

export { m, AnimatePresence };

/**
 * Root wrapper for an animated surface. `display: "contents"` keeps the wrapper
 * out of the layout so it can be dropped around existing markup without
 * changing flow.
 */
export function MotionArea({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div style={{ display: "contents" }}>{children}</div>
      </MotionConfig>
    </LazyMotion>
  );
}

type FeedbackBannerProps = {
  /** When set, the banner is shown; when null/undefined it animates out. */
  message?: string | null;
  /** `error` colours it as a destructive alert; otherwise a success/status note. */
  tone?: "success" | "error";
  /** Override the live-region role. Defaults to alert/status based on tone. */
  role?: "alert" | "status";
  style?: React.CSSProperties;
};

/**
 * Inline status / error feedback that animates in and out. Render it
 * unconditionally — it manages its own presence from `message`.
 */
export function FeedbackBanner({ message, tone = "success", role, style }: FeedbackBannerProps) {
  const isError = tone === "error";
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <m.div
          key={message}
          role={role ?? (isError ? "alert" : "status")}
          variants={feedbackBannerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            borderRadius: "var(--radius-sm)",
            padding: "9px 11px",
            fontSize: 13,
            background: isError ? "var(--error-bg)" : "var(--success-bg)",
            color: isError ? "var(--error-text)" : "var(--success-text)",
            ...style,
          }}
        >
          {message}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
