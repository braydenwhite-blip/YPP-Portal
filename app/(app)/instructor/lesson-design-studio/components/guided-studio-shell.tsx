"use client";

import type { ReactNode } from "react";
import type {
  GuidedStudioJourney,
  GuidedStudioStep,
  StudioPhase,
} from "@/lib/lesson-design-studio";

interface GuidedStudioShellProps {
  eyebrow: string;
  title: string;
  body: string;
  statusLabel: string;
  statusClassName: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  currentPhaseLabel: string;
  sessionsBuiltLabel: string;
  understandingLabel: string;
  blockerLabel: string;
  updatedAtLabel: string;
  workflowNotice?: string | null;
  readOnlyNotice?: string | null;
  readOnlyBody?: string | null;
  journey: GuidedStudioJourney;
  onPhaseChange: (phase: StudioPhase) => void;
  heroActions?: ReactNode;
  children: ReactNode;
}

function getSavePill(saveStatus: GuidedStudioShellProps["saveStatus"]) {
  switch (saveStatus) {
    case "saving":
      return <span className="pill">Saving draft</span>;
    case "saved":
      return <span className="pill pill-success">Draft saved</span>;
    case "error":
      return <span className="pill pill-pending">Save needs attention</span>;
    default:
      return null;
  }
}

function StepPill({
  step,
  isActive,
  onClick,
}: {
  step: GuidedStudioStep;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`lds-journey-pill${isActive ? " active" : ""}`}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <span className={`lds-journey-pill-status ${step.status}`}>{step.status === "complete" ? "✓" : step.shortLabel}</span>
      <span className="lds-journey-pill-copy">
        <strong>{step.label}</strong>
        <small>{step.recommendedAction}</small>
      </span>
    </button>
  );
}

export function GuidedStudioShell({
  eyebrow,
  title,
  body,
  statusLabel,
  statusClassName,
  saveStatus,
  currentPhaseLabel,
  sessionsBuiltLabel,
  understandingLabel,
  blockerLabel,
  updatedAtLabel,
  workflowNotice,
  readOnlyNotice,
  readOnlyBody,
  journey,
  onPhaseChange,
  heroActions,
  children,
}: GuidedStudioShellProps) {
  const activeStep =
    journey.steps.find((step) => step.id === journey.activePhase) ?? journey.steps[0];

  return (
    <div className="cbs-studio lds-shell lds-guided-shell">
      <section className="card lds-guided-hero">
        <div className="lds-guided-hero-top">
          <div className="lds-guided-hero-copy">
            <span className="badge">Lesson Design Studio</span>
            <p className="lds-hero-eyebrow">{eyebrow}</p>
            <h1 className="lds-hero-title">{title}</h1>
            <p className="lds-hero-copy">{body}</p>
          </div>

          <div className="lds-guided-status-stack">
            <span className={statusClassName}>{statusLabel}</span>
            {getSavePill(saveStatus)}
          </div>
        </div>

        <div className="lds-guided-hero-grid">
          <div className="lds-stat-card">
            <span className="lds-stat-label">Current step</span>
            <strong className="lds-stat-value">{currentPhaseLabel}</strong>
          </div>
          <div className="lds-stat-card">
            <span className="lds-stat-label">Sessions built</span>
            <strong className="lds-stat-value">{sessionsBuiltLabel}</strong>
          </div>
          <div className="lds-stat-card">
            <span className="lds-stat-label">Teaching checks</span>
            <strong className="lds-stat-value">{understandingLabel}</strong>
          </div>
          <div className="lds-stat-card">
            <span className="lds-stat-label">Current blockers</span>
            <strong className="lds-stat-value">{blockerLabel}</strong>
          </div>
        </div>

        <div className="lds-guided-focus-row">
          <div className="lds-guided-focus-card">
            <p className="lds-section-eyebrow">Why this step matters</p>
            <h2 className="lds-section-title">{activeStep.headline}</h2>
            <p className="lds-section-copy">{activeStep.whyItMatters}</p>
          </div>
          <div className="lds-guided-focus-card accent">
            <p className="lds-section-eyebrow">Recommended next move</p>
            <h2 className="lds-section-title">{journey.recommendedAction}</h2>
            <p className="lds-section-copy">
              {journey.blockers.length > 0
                ? journey.blockers[0]
                : "You have cleared the blockers for this step. Keep moving with confidence."}
            </p>
          </div>
        </div>

        <div className="lds-guided-hero-actions">
          <div className="lds-inline-actions">{heroActions}</div>
          <span className="lds-updated-at">{updatedAtLabel}</span>
        </div>
      </section>

      {workflowNotice ? (
        <section className="card lds-readonly-banner" role="status">
          <strong>Studio update</strong>
          <p>{workflowNotice}</p>
        </section>
      ) : null}

      {readOnlyNotice && readOnlyBody ? (
        <section className="card lds-readonly-banner">
          <strong>{readOnlyNotice}</strong>
          <p>{readOnlyBody}</p>
        </section>
      ) : null}

      <section className="card lds-guided-journey">
        <div className="lds-guided-journey-header">
          <div>
            <p className="lds-section-eyebrow">Guided journey</p>
            <h2 className="lds-section-title">Stay on the rails while keeping the whole path visible</h2>
          </div>
        </div>
        <div className="lds-guided-pill-row" role="tablist" aria-label="Studio steps">
          {journey.steps.map((step) => (
            <StepPill
              key={step.id}
              step={step}
              isActive={step.id === journey.activePhase}
              onClick={() => onPhaseChange(step.id)}
            />
          ))}
        </div>
      </section>

      {children}
    </div>
  );
}
