"use client";

/**
 * MotionProvider — single swap point for reduced-motion mode in the journey.
 *
 * Reads `useReducedMotion()` from framer-motion and provides either VARIANTS
 * or REDUCED_VARIANTS to all downstream components via context. Downstream
 * components MUST consume `useJourneyMotion()` rather than importing VARIANTS
 * directly (plan §6 Principle 5).
 */

import { createContext, useContext } from "react";
import { useReducedMotion } from "framer-motion";
import { VARIANTS, REDUCED_VARIANTS } from "@/lib/training-journey/motion";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export type JourneyMotionContextValue = {
  /** Resolved variant map — either full or reduced depending on OS preference. */
  variants: typeof VARIANTS | typeof REDUCED_VARIANTS;
  /** True when the user has requested reduced motion. */
  reduced: boolean;
};

const JourneyMotionContext = createContext<JourneyMotionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current journey motion context.
 * Throws if called outside a `<MotionProvider>`.
 */
export function useJourneyMotion(): JourneyMotionContextValue {
  const ctx = useContext(JourneyMotionContext);
  if (ctx === null) {
    throw new Error(
      "useJourneyMotion must be called inside a <MotionProvider>. " +
        "Wrap the journey shell or the component tree with <MotionProvider>."
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type MotionProviderProps = {
  children: React.ReactNode;
};

export function MotionProvider({ children }: MotionProviderProps) {
  // framer-motion reads prefers-reduced-motion from the OS. Returns true when
  // the user has enabled the "Reduce motion" accessibility setting.
  const reduced = useReducedMotion() ?? false;

  const value: JourneyMotionContextValue = {
    variants: reduced ? REDUCED_VARIANTS : VARIANTS,
    reduced,
  };

  return (
    <JourneyMotionContext.Provider value={value}>
      {children}
    </JourneyMotionContext.Provider>
  );
}
