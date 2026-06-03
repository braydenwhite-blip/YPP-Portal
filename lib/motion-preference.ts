"use client";

/**
 * User-facing motion preference.
 *
 * By default the portal follows the device's OS "Reduce motion" accessibility
 * setting (the `"system"` value). Users who *want* full motion regardless of
 * that OS setting can opt in with `"on"`. This lets people actively choose
 * motion instead of being silently overridden by their operating system.
 *
 * The resolved "should we reduce motion?" boolean combines this preference with
 * the OS media query and feeds three places:
 *   1. The training-journey `MotionProvider` (framer-motion VARIANTS swap).
 *   2. The People Strategy `MotionArea` (`<MotionConfig reducedMotion>`).
 *   3. CSS — via a `data-motion="on"` attribute on <html> that the
 *      `prefers-reduced-motion` blocks are scoped to ignore.
 */

import { useSyncExternalStore } from "react";

export type MotionPreference = "system" | "on";

export const MOTION_PREF_KEY = "ypp-motion-pref";

/** Custom event so same-tab listeners react immediately to a preference change. */
export const MOTION_PREF_EVENT = "ypp:motion-pref-change";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Read the stored preference. Safe to call on the server (returns "system"). */
export function readMotionPreference(): MotionPreference {
  if (typeof window === "undefined") return "system";
  try {
    return window.localStorage.getItem(MOTION_PREF_KEY) === "on" ? "on" : "system";
  } catch {
    return "system";
  }
}

/** Mirror the preference onto <html data-motion> so CSS can react to it. */
export function applyMotionAttribute(pref: MotionPreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (pref === "on") root.setAttribute("data-motion", "on");
  else root.removeAttribute("data-motion");
}

/** Persist the preference, reflect it on <html>, and notify listeners. */
export function writeMotionPreference(pref: MotionPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOTION_PREF_KEY, pref);
  } catch {
    /* storage may be unavailable (private mode); the attribute below still applies */
  }
  applyMotionAttribute(pref);
  window.dispatchEvent(new Event(MOTION_PREF_EVENT));
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", callback);
  window.addEventListener(MOTION_PREF_EVENT, callback);
  window.addEventListener("storage", callback); // sync across tabs
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener(MOTION_PREF_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getPrefSnapshot(): MotionPreference {
  return readMotionPreference();
}

function getPrefServerSnapshot(): MotionPreference {
  return "system";
}

function getReducedSnapshot(): boolean {
  if (readMotionPreference() === "on") return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

function getReducedServerSnapshot(): boolean {
  // Matches framer-motion's SSR default: assume full motion until the client resolves.
  return false;
}

/**
 * The resolved decision used by animation code: `true` when motion should be
 * reduced. Honors an explicit `"on"` preference over the OS setting.
 */
export function useResolvedReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getReducedSnapshot, getReducedServerSnapshot);
}

/** Read + update the raw preference. For settings UI. */
export function useMotionPreference(): [MotionPreference, (pref: MotionPreference) => void] {
  const pref = useSyncExternalStore(subscribe, getPrefSnapshot, getPrefServerSnapshot);
  return [pref, writeMotionPreference];
}
