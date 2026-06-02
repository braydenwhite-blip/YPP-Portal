export const DEFAULT_QA_INSTRUCTOR_ONBOARDING_EMAIL =
  "qa.instructor.onboarding@youthpassionproject.org";

export type QaInstructorOnboardingUser = {
  id: string;
  email?: string | null;
  roles?: string[] | null;
  primaryRole?: string | null;
};

function envTrue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function isQaInstructorOnboardingEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envTrue(env.ENABLE_QA_INSTRUCTOR_ONBOARDING);
}

export function getQaInstructorOnboardingEmail(
  env: NodeJS.ProcessEnv = process.env
): string {
  return (
    env.QA_INSTRUCTOR_ONBOARDING_EMAIL?.trim().toLowerCase() ||
    DEFAULT_QA_INSTRUCTOR_ONBOARDING_EMAIL
  );
}

export function isQaInstructorOnboardingEmail(
  email?: string | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (email ?? "").trim().toLowerCase() === getQaInstructorOnboardingEmail(env);
}

export function canManageQaInstructorOnboarding(
  user: QaInstructorOnboardingUser | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!user || !isQaInstructorOnboardingEnabled(env)) return false;
  if (isQaInstructorOnboardingEmail(user.email, env)) return true;

  const roles = new Set([...(user.roles ?? []), user.primaryRole ?? ""].filter(Boolean));
  return roles.has("ADMIN");
}
