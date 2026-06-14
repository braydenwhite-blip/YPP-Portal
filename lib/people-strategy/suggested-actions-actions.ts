"use server";

import { createActionItem } from "./action-items-actions";

/**
 * Confirm a suggested action from meeting notes — creates a tracked ActionItem
 * that preserves its meeting source (officerMeetingId + sourceType "MEETING")
 * and inherits the meeting's linked entity so it lands in the right memory
 * views. Auth, feature-gating, validation, and revalidation are handled inside
 * createActionItem (which is itself a server action).
 */
export async function createActionFromSuggestion(input: {
  meetingId: string;
  title: string;
  leadId: string;
  /** Deadline as yyyy-mm-dd or ISO; required by the tracker. */
  deadline: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<{ id: string }> {
  const linked =
    input.relatedEntityType && input.relatedEntityId
      ? { relatedEntityType: input.relatedEntityType, relatedEntityId: input.relatedEntityId }
      : {};

  return createActionItem({
    title: input.title,
    leadId: input.leadId,
    deadlineStart: input.deadline,
    officerMeetingId: input.meetingId,
    sourceType: "MEETING",
    ...linked,
  });
}
