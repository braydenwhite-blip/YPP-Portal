/**
 * People Strategy — Action ↔ Meeting assignment (pure types).
 *
 * Kept free of prisma/server imports so the client picker
 * (`components/people-strategy/action-assign-meeting-button.tsx`) can import the
 * option type without pulling server code into the bundle. The mutations live in
 * `action-meeting-link-actions.ts` ("use server").
 */

/** A meeting option shown in the Actions hub "+ Add to meeting" picker. */
export type MeetingPickerOption = {
  id: string;
  title: string;
  dateISO: string;
  kindLabel: string;
  status: string;
};
