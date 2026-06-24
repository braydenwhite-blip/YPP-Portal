/**
 * Vercel Preview deployments for internal branch testing (e.g.
 * `preview/brayden-portal`). Preview env vars often mirror production
 * kill-switches (`ENABLE_ACTION_TRACKER=false`, etc.), which hides Actions,
 * Meetings, and People Strategy even after entering the /preview passcode.
 *
 * When this bundle is active, those surfaces default ON so officers can QA
 * the full leadership stack on the same URL as Summer Workshop applicants.
 *
 * Set `PORTAL_PREVIEW_FEATURES=false` on a Preview deployment to restore
 * explicit env-only behavior.
 */

export function isVercelPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/**
 * True on the production Vercel deployment. Used to force the now-GA
 * People-Strategy suite (Action Tracker, Operations Hub, Strategic Initiatives)
 * ON in production regardless of the legacy `ENABLE_*=false` kill-switches that
 * were mirrored into the prod environment. Non-prod keeps the env toggles.
 */
export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function isInternalPreviewFeatureBundleEnabled(): boolean {
  const override = (process.env.PORTAL_PREVIEW_FEATURES ?? "").toLowerCase().trim();
  if (override === "false" || override === "0" || override === "off") return false;
  if (override === "true" || override === "1" || override === "on") return true;
  return isVercelPreviewDeployment();
}
