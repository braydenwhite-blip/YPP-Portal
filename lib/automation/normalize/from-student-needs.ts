// Normalize the EXISTING student-community engine's "Needs You" feed
// (`lib/chapters/student-community.ts` → `StudentCommunityNeed`, including the
// student-experience class interventions the OS loader injects) into canonical
// `AutomationItem`s. Pure projection — absence-streak / attendance-decline /
// feedback detection already lives in student-community.ts and is reused as-is.

import type { StudentCommunityNeed } from "@/lib/chapters/student-community";
import {
  type AutomationItem,
  type AutomationItemType,
  type AutomationSeverity,
} from "@/lib/automation/types";
import { makeAutomationItem } from "@/lib/automation/build-item";
import { automationItemIdFromKey } from "@/lib/automation/item-identity";

function mapSeverity(s: StudentCommunityNeed["severity"]): AutomationSeverity {
  if (s === "critical") return "URGENT";
  if (s === "warning") return "ATTENTION";
  return "INFO";
}

const KEY_PREFIX_TYPE: Record<string, AutomationItemType> = {
  "student-absences": "STUDENT_ABSENCE_STREAK",
  "class-attendance-decline": "ATTENDANCE_DROP",
  "class-never-attended": "STUDENT_ABSENCE_STREAK",
  "class-no-feedback": "FEEDBACK_COLLECTION_DUE",
  "student-negative-feedback": "FEEDBACK_COLLECTION_DUE",
  "student-concern": "FEEDBACK_COLLECTION_DUE",
};

export function studentNeedToAutomationItem(
  n: StudentCommunityNeed,
  chapterId: string,
  now: Date,
  currentWeek?: number
): AutomationItem {
  const prefix = n.key.split(":")[0];
  const type = KEY_PREFIX_TYPE[prefix] ?? "FEEDBACK_COLLECTION_DUE";

  return makeAutomationItem({
    type,
    chapterId,
    now,
    title: n.title,
    description: n.detail ?? "Follow up with the student/family.",
    why: n.detail ? `${n.title} — ${n.detail}` : n.title,
    resolvesWhen: n.detail ?? "Resolve the student-experience concern.",
    primaryActionLabel: n.entityId ? "Open class" : "Open students",
    primaryActionHref: n.href,
    entityType: n.entityType ?? null,
    entityId: n.entityId ?? null,
    severity: mapSeverity(n.severity),
    sourceData: { sourceKey: n.key, sourceSeverity: n.severity },
    currentWeek,
    id: automationItemIdFromKey(type, chapterId, n.key),
  });
}

export function studentNeedsToAutomationItems(
  needs: StudentCommunityNeed[],
  chapterId: string,
  now: Date,
  currentWeek?: number
): AutomationItem[] {
  return needs.map((nd) => studentNeedToAutomationItem(nd, chapterId, now, currentWeek));
}
