import type { ReactNode } from "react";

/**
 * Scopes the professional People Strategy visual surface — neutral canvas,
 * refined typography, compact command bar + filters — to every `/actions/*`
 * view via the `.ps-page` wrapper, without touching the rest of the portal.
 * All visual treatment lives in the `PEOPLE STRATEGY / ACTION TRACKER` block
 * of `app/globals.css`.
 */
export default function ActionsLayout({ children }: { children: ReactNode }) {
  return <div className="ps-page">{children}</div>;
}
