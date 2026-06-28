// Pure merge of stored setting rows over the defaults. Kept free of `server-only`
// and prisma so it is unit-testable and reusable; ./index wraps it with the DB
// read + per-request cache.

import { PORTAL_SETTINGS_DEFAULTS, type PortalSettings } from "./defaults";
import { PORTAL_SETTINGS_GROUP_SCHEMAS } from "./schema";

/**
 * Build the resolved settings object by validating each stored group row and
 * layering it over the hardcoded defaults. An unknown key is ignored; a group
 * whose stored JSON fails validation falls back wholesale to its defaults — so a
 * bad row can never break a page or blank a table.
 */
export function mergePortalSettings(rows: Array<{ key: string; value: unknown }>): PortalSettings {
  // Shallow copy each group so we never mutate the shared defaults constant.
  const merged: PortalSettings = {
    chapterOs: { ...PORTAL_SETTINGS_DEFAULTS.chapterOs },
    peopleStrategy: { ...PORTAL_SETTINGS_DEFAULTS.peopleStrategy },
    classFeedback: { ...PORTAL_SETTINGS_DEFAULTS.classFeedback },
    instructorMentorship: { ...PORTAL_SETTINGS_DEFAULTS.instructorMentorship },
  };

  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const chapterOs = PORTAL_SETTINGS_GROUP_SCHEMAS.chapterOs.safeParse(byKey.get("chapterOs") ?? {});
  if (chapterOs.success) Object.assign(merged.chapterOs, chapterOs.data);

  const peopleStrategy = PORTAL_SETTINGS_GROUP_SCHEMAS.peopleStrategy.safeParse(byKey.get("peopleStrategy") ?? {});
  if (peopleStrategy.success) Object.assign(merged.peopleStrategy, peopleStrategy.data);

  const classFeedback = PORTAL_SETTINGS_GROUP_SCHEMAS.classFeedback.safeParse(byKey.get("classFeedback") ?? {});
  if (classFeedback.success) Object.assign(merged.classFeedback, classFeedback.data);

  const instructorMentorship = PORTAL_SETTINGS_GROUP_SCHEMAS.instructorMentorship.safeParse(
    byKey.get("instructorMentorship") ?? {}
  );
  if (instructorMentorship.success) Object.assign(merged.instructorMentorship, instructorMentorship.data);

  return merged;
}
