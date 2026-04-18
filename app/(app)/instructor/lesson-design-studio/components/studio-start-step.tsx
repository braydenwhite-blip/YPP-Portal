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
    return "Closest match to your draft direction.";
  }

  return `Solid ${seed.interestArea.toLowerCase()} scaffold you can adapt fast.`;
}

export function StudioStartStep({
  starterScaffolds,
  recommendedScaffoldId,
  isReadOnly,
  hasStartedDraft,
  onApplyStarterScaffold,
  onMoveForward,
  onOpenQuickStartWizard,
}: StudioStartStepProps) {
  return (
    <section className="lds-step-layout lds-step-layout--start">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-start-hero">
            <div className="lds-start-hero-copy">
              <p className="lds-section-eyebrow">Start</p>
              <h2 className="lds-section-title">Choose a starter</h2>
              <p className="lds-section-copy">
                Pick a scaffold below — or <strong>Use wizard first</strong> on a card to run the
                wizard before you build the draft.
              </p>
              {hasStartedDraft ? (
                <div className="lds-inline-actions">
                  <button type="button" className="button ghost" onClick={onMoveForward}>
                    Skip and keep editing
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lds-start-gallery-header">
            <div>
              <p className="lds-section-eyebrow">Gallery</p>
              <h3 className="lds-section-title">Starter scaffolds</h3>
              <p className="lds-section-copy">Hover a card for week titles and outcomes.</p>
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
    </section>
  );
}
