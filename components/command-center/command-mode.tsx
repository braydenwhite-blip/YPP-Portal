"use client";

import type { ReactNode } from "react";

import type { CommandMode } from "@/lib/command-mode-cookie";

/**
 * View mode — retired.
 *
 * The portal used to ship a global Calm / Executive density toggle. The
 * redesign collapses every operating surface onto the single rich "YPP Portal"
 * layout from the mockups, so there is no longer a mode to choose: every
 * surface always renders its full detail.
 *
 * This module is kept as a thin, API-compatible shim so the ~130 existing call
 * sites (`ExecutiveOnly`, `CalmOnly`, `CalmCollapse`, `useIsExecutive`,
 * `CommandModeToggle`, …) keep compiling and simply resolve to the full view —
 * no per-file churn, nothing to delete in a hurry. New code should not reach
 * for these; render content directly instead.
 */

export type { CommandMode };

/** The portal renders one view now — the full ("executive") detail. */
const MODE: CommandMode = "executive";

/** Passthrough — there is no mode state to provide anymore. */
export function CommandModeProvider({
  children,
}: {
  children: ReactNode;
  /** Accepted for call-site compatibility; ignored. */
  initialMode?: CommandMode;
}) {
  return <>{children}</>;
}

export function useCommandMode() {
  return { mode: MODE, setMode: (_mode: CommandMode) => {} };
}

/** Always true — the portal only renders the full view now. */
export function useIsExecutive(): boolean {
  return true;
}

/** The full detail always renders. */
export function ExecutiveOnly({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** The calm-only summary is superseded by the full view — it never renders. */
export function CalmOnly(_props: { children: ReactNode }) {
  return null;
}

/**
 * Formerly a density-aware collapse (tucked away in Calm, inline in Executive).
 * With one view, the content always renders inline.
 */
export function CalmCollapse({ children }: { label?: string; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  return <>{children}</>;
}

/** The Calm/Executive pill is gone — nothing to render. */
export function CommandModeToggle(_props: { className?: string; compact?: boolean }) {
  return null;
}
