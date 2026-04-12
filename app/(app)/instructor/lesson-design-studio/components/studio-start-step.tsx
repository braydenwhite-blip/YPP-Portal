"use client";

import type { CSSProperties } from "react";
import type { SeedCurriculum } from "../curriculum-seeds";
import { getActivityTypeConfig } from "./activity-template-data";

interface StudioStartStepProps {
  starterScaffolds: SeedCurriculum[];
  recommendedScaffoldId: string;
  isReadOnly: boolean;
  hasStartedDraft: boolean;
  onApplyStarterScaffold: (seed: SeedCurriculum) => void;
  onMoveForward: () => void;
  onOpenStarterTour: () => void;
  onOpenQuickStartWizard: () => void;
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
      segments: week.activities.slice(0, 4).map((activity, activityIndex) => ({
        id: `${seed.id}-${index}-${activityIndex}`,
        widthPct: total > 0 ? (activity.durationMin / total) * 100 : 0,
        color: getActivityTypeConfig(activity.type).color,
      })),
    };
  });
}

function buildRecommendationReason(seed: SeedCurriculum, isRecommended: boolean) {
  if (isRecommended) {
    return "Best fit because its topic and session rhythm are the closest match to the curriculum direction already visible in your draft.";
  }

  return `A strong option if you want a polished ${seed.interestArea.toLowerCase()} starting point that you can adapt quickly.`;
}

export function StudioStartStep({
  starterScaffolds,
  recommendedScaffoldId,
  isReadOnly,
  hasStartedDraft,
  onApplyStarterScaffold,
  onMoveForward,
  onOpenStarterTour,
  onOpenQuickStartWizard,
}: StudioStartStepProps) {
  return (
    <section className="lds-step-layout">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-start-hero">
            <div className="lds-start-hero-copy">
              <p className="lds-section-eyebrow">Starter support</p>
              <h2 className="lds-section-title">Pick a starter scaffold</h2>
              <p className="lds-section-copy">
                Start with a beautifully structured draft, then tune it until it
                feels fully yours. The quick-start wizard is the fastest route when
                you want help choosing a strong foundation.
              </p>
            </div>

            <div className="lds-start-hero-panel">
              <div className="lds-start-hero-panel-copy">
                <span className="lds-start-hero-kicker">Quick-start wizard</span>
                <strong>Topic → Style → Generate</strong>
                <p>
                  Choose the nearest topic, pick the teaching feel you want, and let
                  the studio prefill the full curriculum skeleton.
                </p>
              </div>
              <div className="lds-inline-actions">
                <button
                  type="button"
                  className="button"
                  disabled={isReadOnly}
                  onClick={onOpenQuickStartWizard}
                >
                  Open quick-start wizard
                </button>
                {hasStartedDraft ? (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={onMoveForward}
                  >
                    Skip and keep editing
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lds-start-gallery-header">
            <div>
              <p className="lds-section-eyebrow">Visual template gallery</p>
              <h3 className="lds-section-title">Choose a premium starting point</h3>
              <p className="lds-section-copy">
                Each starter shows the shape of the course before you commit. Hover
                or focus a card to inspect outcomes and session titles at a glance.
              </p>
            </div>
          </div>

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
                      <span>Session arc preview</span>
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
                            >
                              {bar.segments.map((segment) => (
                                <span
                                  key={segment.id}
                                  className="lds-start-preview-segment"
                                  style={
                                    {
                                      width: `${segment.widthPct}%`,
                                      "--lds-start-preview-accent": segment.color,
                                    } as CSSProperties
                                  }
                                />
                              ))}
                            </span>
                          </div>
                          <span className="lds-start-preview-title">{bar.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lds-start-card-reveal">
                    <div>
                      <span className="lds-start-reveal-label">Outcomes</span>
                      <ul className="lds-start-reveal-list">
                        {seed.outcomes.slice(0, 3).map((outcome) => (
                          <li key={outcome}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="lds-start-reveal-label">First sessions</span>
                      <ul className="lds-start-reveal-list compact">
                        {seed.weeks.slice(0, 4).map((week) => (
                          <li key={week.title}>{week.title}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="lds-start-meta">
                    <span>{seed.weeks.length} sessions</span>
                    <span>{seed.outcomes.length} outcomes</span>
                    <span>{seed.classDurationMin} min/session</span>
                  </div>
                  <p className="lds-start-reason">
                    {buildRecommendationReason(seed, isRecommended)}
                  </p>
                  <div className="lds-start-card-actions">
                    <button
                      type="button"
                      className="button"
                      disabled={isReadOnly}
                      onClick={() => onApplyStarterScaffold(seed)}
                    >
                      Build starter draft
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={isReadOnly}
                      onClick={onOpenQuickStartWizard}
                    >
                      Use wizard first
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="lds-step-side">
        <section className="lds-step-card">
          <p className="lds-section-eyebrow">What happens next</p>
          <h3 className="lds-section-title">Your first draft appears fully shaped</h3>
          <ul className="lds-simple-list">
            <li>The studio builds a full starter curriculum you can edit immediately.</li>
            <li>You refine the course promise, shape each session, and clear readiness checks.</li>
            <li>The scaffold gives you structure, not restrictions.</li>
          </ul>
        </section>

        <section className="lds-step-card">
          <p className="lds-section-eyebrow">Need a slower walkthrough?</p>
          <h3 className="lds-section-title">Use guided starter support step by step</h3>
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
