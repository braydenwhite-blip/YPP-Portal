export const LEGACY_AUTH_BYPASS_EMAILS = [
  "brayden.white@youthpassionproject.org",
  "anthea.zamir@youthpassionproject.org",
  "carlygelles@gmail.com",
  "avery.lin@youthpassionproject.org",
  "jordan.patel@youthpassionproject.org"
];

export function isLegacyAuthBypassEmail(email?: string | null) {
  const norm = (email || "").trim().toLowerCase();
  return LEGACY_AUTH_BYPASS_EMAILS.includes(norm);
}
