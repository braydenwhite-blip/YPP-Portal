/**
 * Motion tokens for the instructor training journey.
 *
 * Intentionally pure constants — no React imports. framer-motion is consumed
 * only by the client components that import these tokens (plan §6, §10 Phase 2).
 *
 * Reduced-motion behavior lives in the player's MotionProvider (Phase 4). That
 * component resolves the VARIANT map to opacity-only fades at DURATIONS.instant
 * when `useReducedMotion()` returns true. The raw tokens below are the
 * full-motion defaults.
 */

export const EASE = [0.4, 0, 0.2, 1] as const;

export const DURATIONS = {
  instant: 0.001,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  moment: 0.4,
} as const;

export const VARIANTS = {
  fadeUp: {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATIONS.base, ease: EASE },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: DURATIONS.fast, ease: EASE },
    },
  },
  beatAdvance: {
    initial: { opacity: 0, x: 24 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: DURATIONS.base, ease: EASE },
    },
    exit: {
      opacity: 0,
      x: -24,
      transition: { duration: DURATIONS.fast, ease: EASE },
    },
  },
  beatBack: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 24 },
  },
  staggerChildren: {
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
  },
  tapScale: { whileTap: { scale: 0.97 } },
  hoverLift: {
    whileHover: {
      y: -2,
      transition: { duration: DURATIONS.fast, ease: EASE },
    },
  },
  badgePop: {
    initial: { scale: 0.6, opacity: 0, rotate: -8 },
    animate: {
      scale: 1,
      opacity: 1,
      rotate: 0,
      transition: { type: "spring", stiffness: 380, damping: 22 },
    },
  },
  checkmarkDraw: {
    initial: { pathLength: 0, opacity: 0 },
    animate: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: DURATIONS.slow, ease: EASE },
    },
  },
} as const;

/** Reduced-motion override — keep in sync with VARIANTS keys. */
export const REDUCED_VARIANTS = {
  fadeUp: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: DURATIONS.instant },
    },
    exit: { opacity: 0, transition: { duration: DURATIONS.instant } },
  },
  beatAdvance: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: DURATIONS.instant } },
    exit: { opacity: 0, transition: { duration: DURATIONS.instant } },
  },
  beatBack: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  staggerChildren: {
    visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
  },
  tapScale: { whileTap: {} },
  hoverLift: { whileHover: {} },
  badgePop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: DURATIONS.fast } },
  },
  checkmarkDraw: {
    initial: { pathLength: 1, opacity: 0 },
    animate: { pathLength: 1, opacity: 1, transition: { duration: DURATIONS.instant } },
  },
} as const;
