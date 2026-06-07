import type { ReactNode } from "react";

/**
 * Applies the shared premium "professional surface" visual language to the
 * Operations Hub via the `.ps-page` wrapper — neutral canvas with soft brand
 * glows, gradient headline, elevated cards — so it matches the Action Tracker
 * and Mentorship without duplicating any CSS.
 */
export default function OperationsLayout({ children }: { children: ReactNode }) {
  return <div className="ps-page ops-page">{children}</div>;
}
