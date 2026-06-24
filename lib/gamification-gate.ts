/**
 * Gamification gate
 * ---------------------------------------------------------------------------
 * Hides the gamification feature set — XP / levels, certificates &
 * certifications, badges, achievements, awards, challenges, competitions,
 * leaderboards, rewards, streaks, and the Passion World — from EVERYONE
 * (students, instructors, AND officers/admins) until it is explicitly turned
 * on. Unlike the public portal gate, there is no role bypass: this is a
 * product-readiness switch, not a permission boundary.
 *
 * One flag controls it all: `ENABLE_GAMIFICATION`. It defaults OFF — set
 * `ENABLE_GAMIFICATION=true` to bring the surfaces back. The data layer (XP
 * accrual, achievement engines, Prisma models) is untouched; only the runtime
 * UI — routes (`proxy.ts`), nav entries (`resolve-nav.ts`), and a few inline
 * XP/level displays embedded in otherwise-kept pages — is gated.
 *
 * Edge-safe: avoids Node-only APIs so it can be imported by `proxy.ts`
 * (Next.js middleware runs on the Edge runtime).
 */

/** Master switch. Defaults OFF — set `ENABLE_GAMIFICATION=true` to expose. */
export function isGamificationEnabled(): boolean {
  return process.env.ENABLE_GAMIFICATION === "true";
}

/**
 * Path prefixes for the dedicated gamification surfaces. When the flag is off,
 * `proxy.ts` redirects these away and `resolve-nav.ts` drops their nav links.
 *
 * Entries are matched as exact-or-subpath (`/awards` matches `/awards` and
 * `/awards/x`, never `/awards-foo`), so sub-paths under otherwise-kept hubs
 * (`/profile`, `/chapter`, `/instructor`, `/learn`, `/my-program`) are listed
 * at their full, specific prefix to avoid catching the parent.
 */
export const GAMIFICATION_GATED_PREFIXES: readonly string[] = [
  // Top-level gamification routes.
  "/achievements",
  "/awards",
  "/badges",
  "/certificates",
  "/challenges",
  "/competitions",
  "/leaderboards",
  "/rewards",
  "/showcases",
  "/student-of-month",
  "/wall-of-fame",
  "/instructor-growth",
  "/world",

  // Specific sub-paths under hubs that are otherwise kept.
  "/profile/xp",
  "/profile/certifications",
  "/chapter/leaderboard",
  "/chapter/achievements",
  "/chapters/leaderboard",
  "/instructor/certifications",
  "/instructor/certification-pathway",
  "/instructor/competition-builder",
  "/mentorship/awards",
  "/mentorship-program/awards",
  "/my-mentor/awards",
  "/my-program/awards",
  "/my-program/achievement-journey",
  "/my-program/certificate",
  "/reflections/streaks",
  "/learn/challenges",
];

/** Whether `pathname` belongs to a gated gamification surface. */
export function isGamificationGatedPath(pathname: string): boolean {
  return GAMIFICATION_GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
