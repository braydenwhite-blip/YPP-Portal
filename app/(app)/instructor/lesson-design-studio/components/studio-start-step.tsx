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

function buildPreviewBars(seed: SeedCurriculum) {
  return seed.weeks.slice(0, 4).map((week, index) => {
    const total = week.activities.reduce(
      (sum, activity) => sum + activity.durationMin,
      0
    );

    return {
      id: `${seed.id}-${index}`,
      label: `W${index + 1}`,
      title: week.title,
      widthPct: Math.min(100, Math.max(30, (total / seed.classDurationMin) * 100)),
    };
  });
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
            Start with a beautifully structured draft, then tune it until it feels fully
            yours.
          </p>

          <div className="lds-start-grid">
            {starterScaffolds.map((seed) => {
              const isRecommended = seed.id === recommendedScaffoldId;
              const previewBars = buildPreviewBars(seed);

              return (
                <article
                  key={seed.id}
                  className={`lds-start-card${isRecommended ? " recommended" : ""}`}
                >
                  <div className="lds-start-card-top">
                    <div>
                      <span className="lds-start-icon" aria-hidden="true">
                        {seed.icon}
                      </span>
                      <p className="lds-start-overline">{seed.interestArea}</p>
                      <h3>{seed.label}</h3>
                    </div>
                    {isRecommended ? (
                      <span className="pill pill-success">Best fit</span>
                    ) : null}
                  </div>
                  <p>{seed.description}</p>

                  <div className="lds-start-preview" aria-hidden="true">
                    <div className="lds-start-preview-header">
                      <span>Starter arc preview</span>
                      <small>{seed.weeks.length} sessions</small>
                    </div>
                    <div className="lds-start-preview-stack">
                      {previewBars.map((bar) => (
                        <div key={bar.id} className="lds-start-preview-row">
                          <span className="lds-start-preview-label">{bar.label}</span>
                          <div className="lds-start-preview-track">
                            <span
                              className="lds-start-preview-fill"
                              style={{ width: `${bar.widthPct}%` }}
                            />
                          </div>
                          <span className="lds-start-preview-title">{bar.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lds-start-meta">
                    <span>{seed.weeks.length} sessions</span>
                    <span>{seed.outcomes.length} outcomes</span>
                    <span>{seed.classDurationMin} min/session</span>
                  </div>
                  {isRecommended ? (
                    <p className="lds-start-reason">
                      Recommended because it is the closest match to the course direction
                      you have started shaping.
                    </p>
                  ) : null}
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
            <li>The studio builds a full starter curriculum you can edit immediately.</li>
            <li>You refine the course promise, shape each session, and clear readiness checks.</li>
            <li>The scaffold gives you structure, not restrictions.</li>
          </ul>
        </section>

        <section className="lds-step-card">
          <p className="lds-section-eyebrow">Need a slower walkthrough?</p>
          <h3 className="lds-section-title">Use starter support step by step</h3>
          <p className="lds-section-copy">
            If you want a guided build, the walkthrough still seeds the curriculum in calm,
            teachable stages.
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
