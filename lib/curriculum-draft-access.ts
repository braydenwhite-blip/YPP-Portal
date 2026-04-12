export interface CurriculumDraftPrintAccessInput {
  requesterId: string;
  requesterRoles?: string[] | null;
  requesterChapterId?: string | null;
  authorId: string;
  authorChapterId?: string | null;
}

export interface CurriculumDraftStudioAccessInput
  extends CurriculumDraftPrintAccessInput {
  draftStatus?: string | null;
}

export function canAccessCurriculumDraftForPrint(
  input: CurriculumDraftPrintAccessInput
) {
  if (input.requesterId === input.authorId) {
    return true;
  }

  const roles = input.requesterRoles ?? [];
  if (roles.includes("ADMIN")) {
    return true;
  }

  return Boolean(
    roles.includes("CHAPTER_PRESIDENT") &&
      input.requesterChapterId &&
      input.authorChapterId &&
      input.requesterChapterId === input.authorChapterId
  );
}

export function canAccessCurriculumDraftForStudio(
  input: CurriculumDraftStudioAccessInput
) {
  return canAccessCurriculumDraftForPrint(input);
}

export function canEditCurriculumDraftInStudio(
  input: CurriculumDraftStudioAccessInput
) {
  if (input.requesterId !== input.authorId) {
    return false;
  }

  const status = String(input.draftStatus ?? "");
  return (
    status === "IN_PROGRESS" ||
    status === "COMPLETED" ||
    status === "NEEDS_REVISION"
  );
}

export function canCommentOnCurriculumDraft(
  input: CurriculumDraftStudioAccessInput
) {
  return canAccessCurriculumDraftForStudio(input);
}

export function canResolveCurriculumDraftComments(
  input: CurriculumDraftStudioAccessInput
) {
  const roles = input.requesterRoles ?? [];
  if (roles.includes("ADMIN")) {
    return true;
  }

  return Boolean(
    roles.includes("CHAPTER_PRESIDENT") &&
      input.requesterChapterId &&
      input.authorChapterId &&
      input.requesterChapterId === input.authorChapterId
  );
}
