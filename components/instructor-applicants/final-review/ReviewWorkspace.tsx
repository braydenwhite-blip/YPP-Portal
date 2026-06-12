/**
 * 12-column responsive grid wrapper that hosts the Feedback panel (left) and
 * the Signal panel (right). Pure layout — no state.
 */

import type { ReactNode } from "react";

export default function ReviewWorkspace({ children }: { children: ReactNode }) {
  return (
    <section
      className="grid grid-cols-1 items-start gap-4 p-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
      aria-label="Final review workspace"
    >
      {children}
    </section>
  );
}
