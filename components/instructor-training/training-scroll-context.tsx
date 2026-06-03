"use client";

import { createContext, useContext, type RefObject } from "react";

/**
 * The training page never scrolls the window — the launchpad shell's
 * `.contentScroll` pane does. Parallax must bind to THAT element, so the shell
 * publishes its scroll node here and motion components read it. Falls back to
 * the viewport when there's no provider.
 */
export const TrainingScrollContext = createContext<RefObject<HTMLElement | null> | null>(
  null,
);

export function useTrainingScrollRef(): RefObject<HTMLElement | null> | null {
  return useContext(TrainingScrollContext);
}
