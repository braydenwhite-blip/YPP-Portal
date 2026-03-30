export const LEGACY_AUTH_BYPASS_EMAIL = "brayden.white@youthpassionproject.org";

export function isLegacyAuthBypassEmail(email?: string | null) {
  return (email || "").trim().toLowerCase() === LEGACY_AUTH_BYPASS_EMAIL;
}
