/**
 * Right column of the cockpit grid (cols 8–12 desktop). Sticky just below the
 * snapshot bar. Holds the readiness meter, risk flags pill, and the pinned
 * rail in later phases.
 */

import type { ReactNode } from "react";

export default function SignalPanel({ children }: { children: ReactNode }) {
  return (
    <aside
      className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20"
      aria-label="Decision signals"
    >
      {children}
    </aside>
  );
}
