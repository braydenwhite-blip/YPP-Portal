import type { ReactNode } from "react";

/**
 * Scopes the premium People-Strategy visual language to every `/mentorship/*`
 * view via the `.ms-page` wrapper — neutral canvas with soft brand glows,
 * gradient headings, and elevated cards — without touching the rest of the
 * portal. All visual treatment lives in the `MENTOR HUB` block of
 * `app/globals.css`.
 */
export default function MentorshipLayout({ children }: { children: ReactNode }) {
  return <div className="ms-page">{children}</div>;
}
