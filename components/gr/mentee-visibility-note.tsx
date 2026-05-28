/**
 * Single source of truth for the "what the mentee can / cannot see" privacy
 * boundary on G&R documents, so admin and mentor surfaces describe visibility
 * with identical language instead of re-typing it on every page.
 */
export const MENTEE_VISIBILITY_COPY =
  "The mentee sees their active goals, recommended resources, and any monthly " +
  "review that a chair has approved and released. Mentor drafts, chair notes, " +
  "and pre-release feedback stay private to staff.";

export function MenteeVisibilityNote() {
  return (
    <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
      {MENTEE_VISIBILITY_COPY}
    </p>
  );
}

export default MenteeVisibilityNote;
