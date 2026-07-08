// Reusable PARTNER-workflow automation export.
//
// The parallel Partner Growth Automation pass owns the partner CRM UI, so this
// pass does NOT render partner pages. Instead it exposes the partner slice of
// the automation brain as data the partner pass can drop into its own surfaces.
// Read-only.

import "server-only";

import { AUTOMATION_TYPE_META, type AutomationItem } from "@/lib/automation/types";
import type { ChapterEscalation } from "@/lib/automation/escalation";
import { loadChapterAutomations } from "@/lib/automation/build-chapter-automation";

export type ChapterPartnerAutomation = {
  chapterId: string;
  chapterName: string;
  /** PARTNERS-workflow automation items, highest urgency first. */
  items: AutomationItem[];
  /** Partner-related escalations for global leadership. */
  escalations: ChapterEscalation[];
};

/**
 * Load just the partner slice of a chapter's automation. Convenience wrapper
 * over `loadChapterAutomations` so the partner pass doesn't re-implement any
 * partner signal logic. Returns null if the chapter is missing.
 */
export async function loadChapterPartnerAutomation(
  chapterId: string
): Promise<ChapterPartnerAutomation | null> {
  const automation = await loadChapterAutomations(chapterId);
  if (!automation) return null;
  return {
    chapterId: automation.chapterId,
    chapterName: automation.chapterName,
    items: automation.byWorkflow.PARTNERS,
    escalations: automation.escalations.filter((e) => AUTOMATION_TYPE_META[e.type].workflow === "PARTNERS"),
  };
}
