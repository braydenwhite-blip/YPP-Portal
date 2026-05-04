/**
 * Left column of the cockpit grid (cols 1–7 desktop). Holds the consensus
 * card, score matrix, and activity feed. Phase 1 ships the wrapper with
 * placeholder children.
 */

import type { ReactNode } from "react";

export default function FeedbackPanel({ children }: { children: ReactNode }) {
  return (
    <section
      className="feedback-panel"
      aria-labelledby="feedback-panel-heading"
      aria-label="Feedback and signals"
    >
      {children}
    </section>
  );
}
