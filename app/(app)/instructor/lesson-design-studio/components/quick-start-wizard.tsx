"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { SeedCurriculum } from "../curriculum-seeds";
import { getActivityTypeConfig } from "./activity-template-data";
import { useBodyScrollLock } from "./use-body-scroll-lock";

const QUICK_START_STYLES = [
  {
    id: "HANDS_ON",
    label: "Hands-on",
    title: "Build with active practice",
    description:
      "Best when you want learners doing something concrete early and often, with clear practice blocks all the way through the course.",
    emphasis: "Practice-heavy rhythm",
  },
  {
    id: "STORY_DRIVEN",
    label: "Story-led",
    title: "Guide with narrative momentum",
    description:
      "Best when you want each session to feel like a chapter, with reflection, discussion, and a stronger emotional through-line.",
    emphasis: "Reflection and discussion",
  },
  {
    id: "LAUNCH_READY",
    label: "Launch-ready",
    title: "Prioritize polished delivery",
    description:
      "Best when you want a clean teachable skeleton fast, so you can move quickly into outcomes, pacing, and final launch details.",
    emphasis: "Fastest path to a full skeleton",
  },
] as const;

type QuickStartStyleId = (typeof QUICK_START_STYLES)[number]["id"];

interface QuickStartWizardProps {
  open: boolean;
  seeds: SeedCurriculum[];
  recommendedSeedId: string;
  readOnly?: boolean;
  onClose: () => void;
  onGenerate: (seed: SeedCurriculum, styleId: QuickStartStyleId) => void;
}

function buildSeedPreview(seed: SeedCurriculum) {
  return seed.weeks.slice(0, 4).map((week, index) => {
    const totalMinutes = week.activities.reduce(
      (sum, activity) => sum + activity.durationMin,
      0
    );

    return {
      id: `${seed.id}-${index}`,
      label: `S${index + 1}`,
      title: week.title,
      totalMinutes,
      segments: week.activities.slice(0, 4).map((activity, activityIndex) => ({
        id: `${seed.id}-${index}-${activityIndex}`,
        widthPct:
          totalMinutes > 0 ? (activity.durationMin / totalMinutes) * 100 : 0,
        color: getActivityTypeConfig(activity.type).color,
      })),
    };
  });
}

function getWizardRecommendation(
  seed: SeedCurriculum | null,
  styleId: QuickStartStyleId | null
) {
  if (!seed || !styleId) return null;

  const style = QUICK_START_STYLES.find((option) => option.id === styleId);
  if (!style) return null;

  if (style.id === "HANDS_ON") {
    return `We’ll use ${seed.label} as the base and frame it as a practice-forward course with strong student action in every session.`;
  }

  if (style.id === "STORY_DRIVEN") {
    return `We’ll use ${seed.label} as the base and spotlight the sequence as a story-like arc with stronger discussion and reflection cues.`;
  }

  return `We’ll generate the full ${seed.label} skeleton and move you straight into refinement so you can tighten the course promise and launch details quickly.`;
}

export function QuickStartWizard({
  open,
  seeds,
  recommendedSeedId,
  readOnly = false,
  onClose,
  onGenerate,
}: QuickStartWizardProps) {
  useBodyScrollLock(open);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSeedId, setSelectedSeedId] = useState<string>(recommendedSeedId);
  const [selectedStyleId, setSelectedStyleId] =
    useState<QuickStartStyleId>("LAUNCH_READY");

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setSelectedSeedId(recommendedSeedId);
    setSelectedStyleId("LAUNCH_READY");
  }, [open, recommendedSeedId]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const selectedSeed =
    seeds.find((seed) => seed.id === selectedSeedId) ?? seeds[0] ?? null;
  const selectedStyle =
    QUICK_START_STYLES.find((style) => style.id === selectedStyleId) ?? null;
  const preview = useMemo(
    () => (selectedSeed ? buildSeedPreview(selectedSeed) : []),
    [selectedSeed]
  );
  const recommendation = getWizardRecommendation(selectedSeed, selectedStyleId);

  if (!open) {
    return null;
  }

  return (
    <div className="lds-wizard-overlay" onClick={onClose}>
      <div
        className="lds-wizard-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick-start wizard"
      >
        <div className="lds-wizard-header">
          <div>
            <p className="lds-section-eyebrow">Quick-start wizard</p>
            <h2 className="lds-wizard-title">Topic, style, then generate</h2>
            <p className="lds-wizard-copy">
              This gives you a full starter curriculum in a few calm steps, using
              the same curated seed library already built into the studio.
            </p>
          </div>
          <button
            type="button"
            className="lds-library-close"
            onClick={onClose}
            aria-label="Close quick-start wizard"
          >
            ×
          </button>
        </div>

        <div className="lds-wizard-progress" aria-label="Wizard progress">
          {[
            { id: 1, label: "Topic" },
            { id: 2, label: "Style" },
            { id: 3, label: "Generate" },
          ].map((item, index, list) => (
            <div
              key={item.id}
              className={`lds-wizard-progress-step${
                step === item.id ? " active" : step > item.id ? " complete" : ""
              }`}
            >
              <span className="lds-wizard-progress-dot" aria-hidden="true">
                {step > item.id ? "✓" : item.id}
              </span>
              <span className="lds-wizard-progress-label">{item.label}</span>
              {index < list.length - 1 ? (
                <span className="lds-wizard-progress-line" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="lds-wizard-body">
          {step === 1 ? (
            <section className="lds-wizard-stage">
              <div className="lds-wizard-stage-header">
                <div>
                  <p className="lds-section-eyebrow">Step 1</p>
                  <h3 className="lds-section-title">Choose the closest topic</h3>
                  <p className="lds-section-copy">
                    Pick the seed that feels nearest to the curriculum you want to
                    teach. We’ll use it as the structure to build from.
                  </p>
                </div>
              </div>

              <div className="lds-wizard-topic-grid">
                {seeds.map((seed) => {
                  const isSelected = seed.id === selectedSeedId;
                  const previewRows = buildSeedPreview(seed);
                  return (
                    <button
                      key={seed.id}
                      type="button"
                      className={`lds-wizard-topic-card${isSelected ? " active" : ""}`}
                      onClick={() => setSelectedSeedId(seed.id)}
                    >
                      <div className="lds-wizard-topic-top">
                        <span className="lds-start-icon" aria-hidden="true">
                          {seed.icon}
                        </span>
                        <div className="lds-wizard-topic-copy">
                          <strong>{seed.label}</strong>
                          <span>{seed.interestArea}</span>
                        </div>
                        {seed.id === recommendedSeedId ? (
                          <span className="pill pill-success">Best fit</span>
                        ) : null}
                      </div>
                      <p>{seed.description}</p>
                      <div className="lds-wizard-topic-preview" aria-hidden="true">
                        {previewRows.map((row) => (
                          <div key={row.id} className="lds-wizard-topic-preview-row">
                            <span className="lds-wizard-topic-preview-label">
                              {row.label}
                            </span>
                            <div className="lds-wizard-topic-preview-track">
                              {row.segments.map((segment) => (
                                <span
                                  key={segment.id}
                                  className="lds-wizard-topic-preview-segment"
                                  style={
                                    {
                                      width: `${segment.widthPct}%`,
                                      "--lds-wizard-preview-accent": segment.color,
                                    } as CSSProperties
                                  }
                                />
                              ))}
                            </div>
                            <span className="lds-wizard-topic-preview-title">
                              {row.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="lds-wizard-stage">
              <div className="lds-wizard-stage-header">
                <div>
                  <p className="lds-section-eyebrow">Step 2</p>
                  <h3 className="lds-section-title">Choose the teaching style lens</h3>
                  <p className="lds-section-copy">
                    In this first version, style shapes the framing and emphasis of the
                    generated starter, while the full seed structure stays intact.
                  </p>
                </div>
              </div>

              <div className="lds-wizard-style-grid">
                {QUICK_START_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`lds-wizard-style-card${
                      style.id === selectedStyleId ? " active" : ""
                    }`}
                    onClick={() => setSelectedStyleId(style.id)}
                  >
                    <span className="lds-wizard-style-label">{style.label}</span>
                    <strong>{style.title}</strong>
                    <p>{style.description}</p>
                    <span className="lds-wizard-style-emphasis">{style.emphasis}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 3 && selectedSeed && selectedStyle ? (
            <section className="lds-wizard-stage">
              <div className="lds-wizard-stage-header">
                <div>
                  <p className="lds-section-eyebrow">Step 3</p>
                  <h3 className="lds-section-title">Generate the starter curriculum</h3>
                  <p className="lds-section-copy">
                    Review the shape we’re about to generate. When you continue, the
                    studio will prefill every session and move you into Course Map.
                  </p>
                </div>
              </div>

              <div className="lds-wizard-review-grid">
                <section className="lds-wizard-review-card emphasis">
                  <p className="lds-section-eyebrow">Selected topic</p>
                  <h4>{selectedSeed.label}</h4>
                  <p>{selectedSeed.description}</p>
                  <div className="lds-start-meta">
                    <span>{selectedSeed.weeks.length} sessions</span>
                    <span>{selectedSeed.outcomes.length} outcomes</span>
                    <span>{selectedSeed.classDurationMin} min/session</span>
                  </div>
                </section>

                <section className="lds-wizard-review-card">
                  <p className="lds-section-eyebrow">Selected style</p>
                  <h4>{selectedStyle.title}</h4>
                  <p>{selectedStyle.description}</p>
                  <span className="lds-wizard-style-emphasis">
                    {selectedStyle.emphasis}
                  </span>
                </section>

                <section className="lds-wizard-review-card wide">
                  <p className="lds-section-eyebrow">What gets generated</p>
                  <div className="lds-wizard-review-preview">
                    {preview.map((row) => (
                      <div key={row.id} className="lds-wizard-review-row">
                        <div>
                          <strong>{row.label}</strong>
                          <span>{row.title}</span>
                        </div>
                        <div className="lds-wizard-review-row-track">
                          {row.segments.map((segment) => (
                            <span
                              key={segment.id}
                              className="lds-wizard-review-row-segment"
                              style={
                                {
                                  width: `${segment.widthPct}%`,
                                  "--lds-wizard-preview-accent": segment.color,
                                } as CSSProperties
                              }
                            />
                          ))}
                        </div>
                        <small>{row.totalMinutes} min planned</small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="lds-wizard-review-card">
                  <p className="lds-section-eyebrow">Learning outcomes</p>
                  <ul className="lds-simple-list">
                    {selectedSeed.outcomes.slice(0, 4).map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </section>

                <section className="lds-wizard-review-card">
                  <p className="lds-section-eyebrow">What happens next</p>
                  <ul className="lds-simple-list">
                    <li>The studio pre-fills every session title, objective, and activity arc.</li>
                    <li>You land in Course Map so you can tune the promise before refining sessions.</li>
                    <li>You can still edit or replace any part of the scaffold afterward.</li>
                  </ul>
                </section>
              </div>

              {recommendation ? (
                <div className="lds-wizard-recommendation">
                  <strong>Recommended framing</strong>
                  <p>{recommendation}</p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="lds-wizard-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancel
          </button>

          {step > 1 ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => setStep((current) => (current - 1) as 1 | 2 | 3)}
            >
              Back
            </button>
          ) : null}

          {step < 3 ? (
            <button
              type="button"
              className="button"
              onClick={() => setStep((current) => (current + 1) as 1 | 2 | 3)}
              disabled={
                readOnly ||
                (step === 1 && !selectedSeed) ||
                (step === 2 && !selectedStyle)
              }
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="button"
              disabled={readOnly || !selectedSeed || !selectedStyle}
              onClick={() => {
                if (!selectedSeed || !selectedStyle) return;
                onGenerate(selectedSeed, selectedStyle.id);
              }}
            >
              Generate starter curriculum
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
