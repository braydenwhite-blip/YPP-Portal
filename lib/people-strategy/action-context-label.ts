import { formatDueDate } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";
import { deriveActionStrategicLinkage } from "./action-source";

/**
 * People Strategy — connected context for an action.
 *
 * One of the biggest readability wins of the redesign: an action should say
 * WHERE it came from in plain English — "From Leadership Meeting — June 10",
 * "Connected to Instructor Orientation", "Related partner". Pure: no DB, no
 * React; it reads only what the row already carries (the meeting relation, the
 * strategic registry link, the polymorphic entity type).
 *
 * It REUSES {@link deriveActionStrategicLinkage} (registry titles + hrefs) and
 * the loaded `officerMeeting` relation rather than re-resolving them. The
 * polymorphic related entity (class/partner/person/applicant) has no name
 * loaded here, so the label is the entity's plain noun; the live link to that
 * record stays with the existing `RelatedEntityBadge` in the UI.
 */

export type ActionConnectedContext = {
  /** Plain-English label, e.g. "From Leadership Meeting — June 10". */
  text: string;
  /** A link to the originating record, when one is resolvable. */
  href: string | null;
};

const RELATED_ENTITY_NOUN: Record<string, string> = {
  CLASS_OFFERING: "class",
  MENTORSHIP: "mentorship",
  USER: "person",
  INSTRUCTOR_APPLICATION: "applicant",
  PARTNER: "partner",
};

/**
 * Resolve the single most meaningful "where this came from" label for an
 * action, in priority order: meeting → initiative → project → related entity.
 * Returns `null` when the action is free-standing (manual, no links).
 */
export function deriveActionContextLabel(
  item: ActionItemWithRelations
): ActionConnectedContext | null {
  // A concrete meeting is the clearest provenance — name it and date it.
  if (item.officerMeeting) {
    const title = item.officerMeeting.title?.trim() || "meeting";
    return {
      text: `From ${title} — ${formatDueDate(item.officerMeeting.date)}`,
      href: `/actions/meetings/${item.officerMeetingId}`,
    };
  }
  if (item.officerMeetingId) {
    return { text: "From a meeting", href: `/actions/meetings/${item.officerMeetingId}` };
  }

  // An affirmed strategic initiative / project explains the "why".
  const strategic = deriveActionStrategicLinkage(item);
  if (strategic.initiativeTitle) {
    return {
      text: `Connected to ${strategic.initiativeTitle}`,
      href: strategic.initiativeHref,
    };
  }
  if (strategic.projectTitle) {
    return { text: `Part of ${strategic.projectTitle}`, href: strategic.projectHref };
  }

  // A polymorphic record link — class / partner / person / applicant.
  if (item.relatedEntityType && item.relatedEntityId) {
    const noun = RELATED_ENTITY_NOUN[item.relatedEntityType] ?? "record";
    return { text: `Related ${noun}`, href: null };
  }

  return null;
}
