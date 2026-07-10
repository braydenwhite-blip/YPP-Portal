"use server";

import { requireSessionUser } from "@/lib/authorization";
import { getChairDraft } from "@/lib/final-review-queries";

export async function loadWorkspaceChairDraft(applicationId: string) {
  const user = await requireSessionUser();
  const draft = await getChairDraft(applicationId, user.id);
  return {
    rationale: draft.rationale,
    comparisonNotes: draft.comparisonNotes,
    savedAt: draft.savedAt,
  };
}
