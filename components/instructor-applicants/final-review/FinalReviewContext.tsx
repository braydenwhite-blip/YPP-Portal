"use client";

/**
 * Cross-section state for the Final Review Cockpit (§5.3 of the redesign plan).
 *
 * Owns the two pieces of state that need to be visible to multiple sibling
 * sections: `focusedReviewerId` (for matrix ↔ feed highlighting) and
 * `pinnedSignalIds` (for the pinned rail). Phase 1 ships the API surface;
 * Phase 3 wires the matrix highlight + pinned-signals rail.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface FinalReviewContextValue {
  focusedReviewerId: string | null;
  setFocusedReviewerId: (id: string | null) => void;
  pinnedSignalIds: string[];
  togglePin: (signalId: string) => void;
  quoteIntoRationale: (quote: string) => void;
  registerQuoteHandler: (handler: ((quote: string) => void) | null) => void;
}

const FinalReviewContext = createContext<FinalReviewContextValue | null>(null);

export interface FinalReviewProviderProps {
  children: ReactNode;
  initialPinnedSignalIds?: string[];
}

export function FinalReviewProvider({
  children,
  initialPinnedSignalIds = [],
}: FinalReviewProviderProps) {
  const [focusedReviewerId, setFocusedReviewerId] = useState<string | null>(null);
  const [pinnedSignalIds, setPinnedSignalIds] = useState<string[]>(initialPinnedSignalIds);
  const [quoteHandler, setQuoteHandler] = useState<((quote: string) => void) | null>(null);

  const togglePin = useCallback((signalId: string) => {
    setPinnedSignalIds((prev) =>
      prev.includes(signalId) ? prev.filter((id) => id !== signalId) : [...prev, signalId]
    );
  }, []);

  const registerQuoteHandler = useCallback(
    (handler: ((quote: string) => void) | null) => {
      setQuoteHandler(() => handler);
    },
    []
  );

  const quoteIntoRationale = useCallback(
    (quote: string) => {
      quoteHandler?.(quote);
    },
    [quoteHandler]
  );

  const value = useMemo<FinalReviewContextValue>(
    () => ({
      focusedReviewerId,
      setFocusedReviewerId,
      pinnedSignalIds,
      togglePin,
      quoteIntoRationale,
      registerQuoteHandler,
    }),
    [focusedReviewerId, pinnedSignalIds, togglePin, quoteIntoRationale, registerQuoteHandler]
  );

  return <FinalReviewContext.Provider value={value}>{children}</FinalReviewContext.Provider>;
}

export function useFinalReviewContext(): FinalReviewContextValue {
  const ctx = useContext(FinalReviewContext);
  if (!ctx) {
    throw new Error("useFinalReviewContext must be used within FinalReviewProvider");
  }
  return ctx;
}

export function useFocusedReviewer(): [string | null, (id: string | null) => void] {
  const { focusedReviewerId, setFocusedReviewerId } = useFinalReviewContext();
  return [focusedReviewerId, setFocusedReviewerId];
}

export function usePinnedSignals(): { ids: string[]; toggle: (id: string) => void } {
  const { pinnedSignalIds, togglePin } = useFinalReviewContext();
  return { ids: pinnedSignalIds, toggle: togglePin };
}
