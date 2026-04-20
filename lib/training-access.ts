type RoleLike = string | null | undefined;

const APPROVED_INSTRUCTOR_TRAINING_ROLES = new Set([
  "ADMIN",
  "CHAPTER_PRESIDENT",
  "INSTRUCTOR",
]);

export function hasApprovedInstructorTrainingAccess(
  roles: RoleLike[] = []
): boolean {
  return roles.some((role) =>
    role ? APPROVED_INSTRUCTOR_TRAINING_ROLES.has(role) : false
  );
}

export function canAccessTrainingLearnerActions(roles: RoleLike[] = []): boolean {
  return (
    roles.includes("STUDENT") || hasApprovedInstructorTrainingAccess(roles)
  );
}

export function getTrainingAccessRedirect(roles: RoleLike[] = []): string {
  return roles.includes("APPLICANT") ? "/application-status" : "/";
}
