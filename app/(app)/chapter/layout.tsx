import type { ReactNode } from "react";

/**
 * Scopes the premium People-Strategy visual language to every `/chapter/*`
 * view via the `.ps-page` wrapper — neutral canvas with soft brand glows,
 * gradient headings, and elevated cards — plus the `.psuite` flourishes
 * (gradient avatars, fill meters, status chips) used across the people
 * surfaces. All visual treatment lives in `app/globals.css`.
 */
export default function ChapterLayout({ children }: { children: ReactNode }) {
  return <div className="ps-page psuite">{children}</div>;
}
