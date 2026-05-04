/**
 * 12-column responsive grid wrapper that hosts the Feedback panel (left) and
 * the Signal panel (right). Pure layout — no state.
 */

import type { ReactNode } from "react";

export default function ReviewWorkspace({ children }: { children: ReactNode }) {
  return (
    <section className="review-workspace" aria-label="Final review workspace">
      {children}
    </section>
  );
}
