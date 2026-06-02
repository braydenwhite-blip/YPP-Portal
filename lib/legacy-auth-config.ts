import {
  getQaInstructorOnboardingEmail,
  isQaInstructorOnboardingEnabled,
} from "@/lib/qa-instructor-onboarding";

export const LEGACY_AUTH_BYPASS_EMAILS = [
  "brayden.white@youthpassionproject.org",
  "anthea.zamir@youthpassionproject.org",
  "carlygelles@gmail.com",
  "avery.lin@youthpassionproject.org",
  "jordan.patel@youthpassionproject.org",
  "milo.wald@youthpassionproject.org"
];

export function isLegacyAuthBypassEmail(email?: string | null) {
  const norm = (email || "").trim().toLowerCase();
  const isQaInstructorFixture = norm === getQaInstructorOnboardingEmail();
  return (
    LEGACY_AUTH_BYPASS_EMAILS.includes(norm) ||
    (isQaInstructorFixture &&
      (typeof window !== "undefined" || isQaInstructorOnboardingEnabled()))
  );
}
