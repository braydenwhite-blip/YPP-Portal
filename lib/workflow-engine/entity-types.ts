/**
 * Universal Workflow Engine — attachable entity-type vocabulary (pure).
 *
 * The kinds of real (or registry) entities a WorkflowInstance can be the
 * PRIMARY subject of (WorkflowInstance.subjectType/subjectId) or a SECONDARY
 * attachment of (WorkflowAttachment.entityType/entityId — see attachment.ts).
 * Pure: no server-only imports, so it is shared by server actions, server
 * components, and client components alike. Mirrors the vocabulary idiom in
 * lib/partners-constants.ts / lib/people-strategy/action-source.ts (an
 * uppercase `as const` array, a derived type, an `isX` guard, and a labels map).
 *
 * "USER" covers both Instructor and Student — they are User rows distinguished
 * by role, not their own tables — so its label is the generic "Person".
 * "INITIATIVE" ids are strategic-initiative REGISTRY keys (see
 * lib/people-strategy/strategic-initiatives.ts), not database row ids — there
 * is no InitiativeItem table to join against.
 */

export const WORKFLOW_ENTITY_TYPE_VALUES = [
  "CHAPTER",
  "PARTNER",
  "INSTRUCTOR_APPLICATION",
  "CHAPTER_PRESIDENT_APPLICATION",
  "USER",
  "MENTORSHIP",
  "CLASS_OFFERING",
  "CURRICULUM_DRAFT",
  "SPECIAL_PROGRAM",
  "MEETING",
  "ACTION_ITEM",
  "INITIATIVE",
] as const;

export type WorkflowEntityType = (typeof WORKFLOW_ENTITY_TYPE_VALUES)[number];

export function isWorkflowEntityType(value: unknown): value is WorkflowEntityType {
  return (
    typeof value === "string" &&
    (WORKFLOW_ENTITY_TYPE_VALUES as readonly string[]).includes(value)
  );
}

export const WORKFLOW_ENTITY_TYPE_LABELS: Record<WorkflowEntityType, string> = {
  CHAPTER: "Chapter",
  PARTNER: "Partner",
  INSTRUCTOR_APPLICATION: "Instructor application",
  CHAPTER_PRESIDENT_APPLICATION: "Chapter president application",
  USER: "Person",
  MENTORSHIP: "Mentorship",
  CLASS_OFFERING: "Class offering",
  CURRICULUM_DRAFT: "Curriculum draft",
  SPECIAL_PROGRAM: "Special program",
  MEETING: "Meeting",
  ACTION_ITEM: "Action item",
  INITIATIVE: "Initiative",
};

/** Label for an entity type, falling back to the raw value for a stale/unknown one. */
export function workflowEntityTypeLabel(value: string | null | undefined): string {
  return isWorkflowEntityType(value) ? WORKFLOW_ENTITY_TYPE_LABELS[value] : (value ?? "Unknown");
}
