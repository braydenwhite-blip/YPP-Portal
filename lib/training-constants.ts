/**
 * Training system shared constants.
 *
 * Centralized so that hard-coded module keys and trackable-provider sets
 * cannot drift between page templates, gate logic, and server actions.
 *
 * Anything that compares against `module.contentKey` should import from
 * here so a single rename of a curriculum module is a one-file change.
 */

import type { VideoProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Module content keys
// ---------------------------------------------------------------------------

/** Module 5 — Readiness Check (interactive journey, gates LDS). */
export const READINESS_CHECK_MODULE_KEY = "academy_readiness_check_005";

/** Module 6 — Lesson Design Studio capstone (gated by Readiness Check). */
export const LESSON_DESIGN_STUDIO_MODULE_KEY = "academy_lesson_studio_004";

// ---------------------------------------------------------------------------
// Video providers we can track to completion
// ---------------------------------------------------------------------------

/**
 * Required academy modules whose `videoUrl` is set must use one of these
 * providers; otherwise the player has no reliable "ended" signal and
 * watch-completion can never fire.
 */
export const TRACKABLE_REQUIRED_VIDEO_PROVIDERS: ReadonlySet<VideoProvider> = new Set([
  "YOUTUBE",
  "VIMEO",
  "CUSTOM",
]);

export function isTrackableVideoProvider(
  provider: VideoProvider | null | undefined
): boolean {
  return provider != null && TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(provider);
}
