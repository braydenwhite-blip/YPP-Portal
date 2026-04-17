export interface CurriculumDraftPrintAccessInput {
  requesterId: string;
  requesterRoles?: string[] | null;
  requesterFeatureKeys?: string[] | null;
  requesterChapterId?: string | null;
  authorId: string;
  authorChapterId?: string | null;
}

export function canAccessCurriculumDraftForPrint(
  input: CurriculumDraftPrintAccessInput
) {
  if (input.requesterId === input.authorId) {
    return true;
  }

  const roles = input.requesterRoles ?? [];
  const featureKeys = input.requesterFeatureKeys ?? [];
  if (roles.includes("ADMIN")) {
    return true;
  }

  return Boolean(
    (roles.includes("CHAPTER_PRESIDENT") || featureKeys.includes("INTERVIEWER")) &&
      input.requesterChapterId &&
      input.authorChapterId &&
      input.requesterChapterId === input.authorChapterId
  );
}
