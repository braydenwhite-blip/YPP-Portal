/**
 * Motion tokens for the People Strategy / Action Tracker surfaces.
 *
 * Pure constants — no React, no framer-motion imports — so they can be shared
 * by server and client modules alike. The client components in
 * `components/people-strategy/motion.tsx` consume these and wrap their trees in
 * a `<MotionConfig reducedMotion="user">`, which automatically downgrades the
 * transform-based variants below to opacity-only when the OS "Reduce motion"
 * setting is on. That keeps a single source of truth for both modes.
 *
 * The intent is restraint: subtle opacity/y fades that clarify *what just
 * changed* (a banner appeared, a card revealed, a row left a list), never
 * decorative or looping motion.
 */

// Shared easing — matches the training-journey curve so motion reads as one
// system across the portal.
export const EASE = [0.4, 0, 0.2, 1] as const;

export const DURATIONS = {
  /** Near-instant; used as the reduced-motion / "no real travel" floor. */
  instant: 0.001,
  fast: 0.15,
  base: 0.2,
  slow: 0.28,
} as const;

/**
 * Inline status / error feedback (action saved, comment posted, validation
 * error). A small fade + lift so the eye catches the new message without a
 * jarring pop. Paired with <AnimatePresence> so dismissal fades out too.
 */
export const feedbackBannerVariants = {
  initial: { opacity: 0, y: -4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.base, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DURATIONS.fast, ease: EASE },
  },
} as const;

/**
 * One-time reveal for a detail card / panel on mount (e.g. opening an action's
 * detail page). `initial` only fires on real mount, so router.refresh()
 * re-renders do not re-trigger it.
 */
export const cardRevealVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.slow, ease: EASE },
  },
} as const;

/**
 * List rows that enter/leave (escalation cards being resolved, meeting blocks).
 * Used with <AnimatePresence> + `layout` so neighbours slide to fill the gap.
 */
export const listItemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.base, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: DURATIONS.fast, ease: EASE },
  },
} as const;

/**
 * Collapsible disclosure regions (show/hide past meetings, comment history,
 * an inline form). Opacity + slight lift; height is intentionally left to the
 * browser to avoid janky measured-height animations.
 */
export const disclosureVariants = {
  initial: { opacity: 0, y: -4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.base, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DURATIONS.fast, ease: EASE },
  },
} as const;
