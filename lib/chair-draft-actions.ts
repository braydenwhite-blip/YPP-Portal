"use server";

/**
 * `saveChairDraft` — autosave entry point for the cockpit's draft rationale.
 *
 * Phase 2B contract per `FINAL_REVIEW_REDESIGN_PLAN.md` §7.7. The plan adds an
 * `InstructorApplicationChairDraft` Prisma model in §11; until that migration
 * lands the action is a thin RBAC + validation gate that succeeds without
 * persisting on the server. The cockpit's `DraftRationaleField` keeps a
 * localStorage warm cache keyed by `final-review-draft:{appId}:{chairId}` so
 * drafts survive reload even though server persistence is deferred.
 */

import { getSession } from "@/lib/auth-supabase";
import { getHiringActor, assertCanActAsChair } from "@/lib/chapter-hiring-permissions";
import { prisma } from "@/lib/prisma";

const RATIONALE_HARD_LIMIT = 10_000;

export type SaveChairDraftResult =
  | { success: true; savedAt: string }
  | { success: false; error: string };

export async function saveChairDraft(formData: FormData): Promise<SaveChairDraftResult> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    const rationale = String(formData.get("rationale") ?? "");
    const comparisonNotes = String(formData.get("comparisonNotes") ?? "");

    if (!applicationId) {
      return { success: false, error: "Missing applicationId." };
    }
    if (rationale.length > RATIONALE_HARD_LIMIT) {
      return { success: false, error: "Rationale exceeds the 10 000 character limit." };
    }
    if (comparisonNotes.length > RATIONALE_HARD_LIMIT) {
      return { success: false, error: "Comparison notes exceed the 10 000 character limit." };
    }

    const actor = await getHiringActor(session.user.id);
    assertCanActAsChair(actor);

    const saved = await prisma.instructorApplicationChairDraft.upsert({
      where: {
        applicationId_chairId: {
          applicationId,
          chairId: actor.id,
        },
      },
      update: { rationale, comparisonNotes },
      create: {
        applicationId,
        chairId: actor.id,
        rationale,
        comparisonNotes,
      },
      select: { savedAt: true },
    });

    return { success: true, savedAt: saved.savedAt.toISOString() };
  } catch (error) {
    console.error("[saveChairDraft]", error);
    return { success: false, error: "Could not save draft — try again." };
  }
}
