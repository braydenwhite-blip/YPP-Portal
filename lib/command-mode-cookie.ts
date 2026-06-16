/**
 * Calm / Executive — the one shared definition of the global view mode.
 *
 * This module has NO "use client" / server directive on purpose: both the
 * server layout (which reads the cookie so the first paint matches the user's
 * choice — no Calm→Executive flash) and the client provider import from here,
 * so there is exactly one source of truth for the mode name, the cookie key,
 * and how a raw value is validated.
 *
 * Calm is the default everywhere. Executive is the opt-in denser view.
 */

export type CommandMode = "calm" | "executive";

/** The default mode for anyone who has never chosen — calm, never overwhelming. */
export const DEFAULT_COMMAND_MODE: CommandMode = "calm";

/** Cookie the server reads to render the correct mode on first paint. */
export const COMMAND_MODE_COOKIE = "ypp-command-mode";

/** localStorage key — kept for cross-tab sync and returning visitors. */
export const COMMAND_MODE_STORAGE_KEY = "ypp:command-mode";

/** Same-tab broadcast so every consumer stays in sync without a navigation. */
export const COMMAND_MODE_EVENT = "ypp:command-mode-change";

export function isCommandMode(value: unknown): value is CommandMode {
  return value === "calm" || value === "executive";
}

/** Validate a raw cookie / storage value, returning null when it isn't a mode. */
export function parseCommandMode(value: string | undefined | null): CommandMode | null {
  return isCommandMode(value) ? value : null;
}
