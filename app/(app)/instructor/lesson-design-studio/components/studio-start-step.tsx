"use client";

import type { SeedCurriculum } from "../curriculum-seeds";

interface StudioStartStepProps {
  starterScaffolds: SeedCurriculum[];
  recommendedScaffoldId: string;
  isReadOnly: boolean;
  hasStartedDraft: boolean;
  onApplyStarterScaffold: (seed: SeedCurriculum) => void;
  onMoveForward: () => void;
  onOpenStarterTour: () => void;
}

export function StudioStartStep({
  starterScaffolds,
  recommendedScaffoldId,
  isReadOnly,
  hasStartedDraft,
  onApplyStarterScaffold,
  onMoveForward,
  onOpenStarterTour,
}: StudioStartStepProps) {
  return (
    <section className="lds-step-layout">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <p className="lds-section-eyebrow">Starter support</p>
          <h2 className="lds-section-title">Choose how you want to begin</h2>
          <p className="lds-section-copy">
            First-time instructors usually move faster when the studio gives them a strong
            first draft to react to. You can still change every word later.
          </p>

          <div className="lds-start-grid">
            {starterScaffolds.map((seed) => {
              const isRecommended = seed.id === recommendedScaffoldId;

              return (
                <article
                  key={seed.id}
                  className={`lds-start-card${isRecommended ? " recommended" : ""}`}
                >
                  <div className="lds-start-card-top">
                    <div>
                      <span className="lds-start-icon">{seed.icon}</span>
                      <h3>{seed.label}</h3>
                    </div>
                    {isRecommended ? <span className="pill pill-success">Best fit</span> : null}
                  </div>
                  <p>{seed.description}</p>
                  <div className="lds-start-meta">
                    <span>{seed.weeks.length} sessions</span>
                    <span>{seed.outcomes.length} outcomes</span>
                    <span>{seed.classDurationMin} min/session</span>
                  </div>
                  <button
                    type="button"
                    className="button"
                    disabled={isReadOnly}
                    onClick={() => onApplyStarterScaffold(seed)}
                  >
                    Build starter draft
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="lds-step-side">
        <section className="lds-step-card">
          <p className="lds-section-eyebrow">How this works</p>
          <h3 className="lds-section-title">What happens next</h3>
          <ul className="lds-simple-list">
            <li>The studio creates a full starter curriculum you can edit immediately.</li>
            <li>You then tighten the course promise, refine each session, and clear readiness checks.</li>
            <li>Nothing here locks you in. The scaffold is a support beam, not a script.</li>
          </ul>
        </section>

        <section className="lds-step-card">
          <p className="lds-section-eyebrow">Need a slower walkthrough?</p>
          <h3 className="lds-section-title">Use starter support step by step</h3>
          <p className="lds-section-copy">
            If you want the old hand-holding feeling, you can still launch the guided starter
            walkthrough and let it seed the curriculum in stages.
          </p>
          <div className="lds-inline-actions">
            <button
              type="button"
              className="button secondary"
              disabled={isReadOnly}
              onClick={onOpenStarterTour}
            >
              Rebuild with starter support
            </button>
            {hasStartedDraft ? (
              <button type="button" className="button ghost" onClick={onMoveForward}>
                Skip and keep editing
              </button>
            ) : null}
          </div>
        </section>
      </aside>
    </section>
  );
}
