/**
 * Right column of the cockpit grid (cols 8–12 desktop). Sticky just below the
 * snapshot bar. Holds the readiness meter, risk flags pill, and the pinned
 * rail in later phases.
 */

import type { ReactNode } from "react";

export default function SignalPanel({ children }: { children: ReactNode }) {
  return (
    <aside
      className="signal-panel"
      aria-label="Decision signals"
    >
      {children}
    </aside>
  );
}
