// Normalize the EXISTING deterministic blocker engine
// (`lib/chapters/needs-attention-rules.ts` → `ChapterBlocker`, plus the live
// class interventions that the OS loader injects into the same list) into the
// canonical `AutomationItem`. We do NOT re-derive any signal — this is a pure
// projection that preserves each blocker's stable `key` (so identity survives)
// and its evidence-rich title/detail/suggestedAction.

import type { ChapterBlocker, ChapterLane } from "@/lib/chapters/needs-attention-rules";
import {
  AUTOMATION_TYPE_META,
  type AutomationItem,
  type AutomationItemType,
  type AutomationEntityType,
  type AutomationSeverity,
} from "@/lib/automation/types";
import { makeAutomationItem } from "@/lib/automation/build-item";
import { automationItemIdFromKey } from "@/lib/automation/item-identity";

/** ChapterBlocker.severity → AutomationSeverity (type default may upgrade it). */
function mapSeverity(s: ChapterBlocker["severity"], typeDefault: AutomationSeverity): AutomationSeverity {
  if (s === "critical") return typeDefault === "BLOCKING" ? "BLOCKING" : "URGENT";
  if (s === "warning") return "ATTENTION";
  return "INFO";
}

/** Per-lane fallback when a blocker key prefix isn't explicitly mapped (e.g. a
 *  class-intervention key). Keeps the item in the right workflow regardless. */
const LANE_FALLBACK: Record<ChapterLane, AutomationItemType> = {
  partners: "PARTNER_FOLLOW_UP_DUE",
  instructors: "INSTRUCTOR_APPLICATION_REVIEW_DUE",
  curriculum: "CURRICULUM_REVIEW_DUE",
  classes: "CLASS_MISSING_INSTRUCTOR",
};

/** Map a blocker key PREFIX (before the first ':') → a precise automation type. */
const KEY_PREFIX_TYPE: Record<string, AutomationItemType> = {
  // partners (needs-attention-rules.ts)
  "partner-followup": "PARTNER_FOLLOW_UP_DUE",
  "partner-no-response": "PARTNER_FOLLOW_UP_DUE",
  "partner-no-meeting": "PARTNER_FOLLOW_UP_DUE",
  "partner-logistics": "PARTNER_LOGISTICS_INCOMPLETE",
  // instructors
  "applicant-review": "INSTRUCTOR_APPLICATION_REVIEW_DUE",
  "applicant-interview": "INSTRUCTOR_INTERVIEW_UNSCHEDULED",
  "applicant-decision": "INSTRUCTOR_INTERVIEW_DECISION_DUE",
  "applicant-materials": "INSTRUCTOR_READINESS_CHECK_DUE",
  // curriculum
  "curriculum-review": "CURRICULUM_REVIEW_DUE",
  "curriculum-send-global": "CURRICULUM_GLOBAL_REVIEW_READY",
  "curriculum-global-review": "CURRICULUM_REVIEW_DUE",
  // classes (needs-attention-rules.ts + class interventions)
  "class-no-instructor": "CLASS_MISSING_INSTRUCTOR",
  "class-no-partner": "CLASS_MISSING_LOCATION",
  "class-no-curriculum": "CURRICULUM_SUBMISSION_MISSING",
  "class-not-public": "CLASS_NOT_PUBLIC",
  "class-under-enrolled": "ENROLLMENT_LOW",
  "class-no-reminder": "PRE_LAUNCH_REMINDER_DUE",
  "class-instructor-not-ready": "INSTRUCTOR_READINESS_CHECK_DUE",
};

function entityTypeFor(b: ChapterBlocker): AutomationEntityType | null {
  if (b.entityType) return b.entityType;
  return null;
}

/** Per-workflow primary action verb. */
const PRIMARY_LABEL: Record<ChapterLane, string> = {
  partners: "Open partner",
  instructors: "Open applicant",
  curriculum: "Open curriculum",
  classes: "Open class",
};

/** Project one blocker → one automation item. */
export function blockerToAutomationItem(
  b: ChapterBlocker,
  chapterId: string,
  now: Date,
  currentWeek?: number
): AutomationItem {
  const prefix = b.key.split(":")[0];
  const type = KEY_PREFIX_TYPE[prefix] ?? LANE_FALLBACK[b.lane];
  const meta = AUTOMATION_TYPE_META[type];
  const severity = mapSeverity(b.severity, meta.defaultSeverity);

  return makeAutomationItem({
    type,
    chapterId,
    now,
    title: b.title,
    description: b.detail ?? b.suggestedAction,
    why: b.detail ? `${b.title} — ${b.detail}` : b.title,
    resolvesWhen: b.suggestedAction,
    primaryActionLabel: PRIMARY_LABEL[b.lane],
    primaryActionHref: b.href,
    entityType: entityTypeFor(b),
    entityId: b.entityId ?? null,
    severity,
    sourceData: { sourceKey: b.key, lane: b.lane, sourceSeverity: b.severity },
    currentWeek,
    // Preserve the engine's stable per-(rule, subject) key as the id namespace.
    id: automationItemIdFromKey(type, chapterId, b.key),
  });
}

/** Project a list of blockers → canonical items. */
export function blockersToAutomationItems(
  blockers: ChapterBlocker[],
  chapterId: string,
  now: Date,
  currentWeek?: number
): AutomationItem[] {
  return blockers.map((b) => blockerToAutomationItem(b, chapterId, now, currentWeek));
}
