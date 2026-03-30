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
  toast?:
    | {
        kind: "error" | "success";
        message: string;
      }
    | null;
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

function getSaveIndicator(saveStatus: GuidedStudioShellProps["saveStatus"]) {
  switch (saveStatus) {
    case "saving":
      return {
        tone: "saving",
        label: "Saving...",
        detail: "Autosave is syncing your latest edits.",
      };
    case "saved":
      return {
        tone: "saved",
        label: "Saved",
        detail: "Your latest draft changes are safely stored.",
      };
    case "error":
      return {
        tone: "error",
        label: "Save error",
        detail: "The last save needs attention before you keep moving.",
      };
    default:
      return {
        tone: "idle",
        label: "Autosave on",
        detail: "Changes save automatically while you build.",
      };
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
      className={`lds-journey-pill ${step.status}${isActive ? " active" : ""}`}
      onClick={onClick}
      aria-current={isActive ? "step" : undefined}
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
  toast,
  journey,
  onPhaseChange,
  heroActions,
  children,
}: GuidedStudioShellProps) {
  const activeStep =
    journey.steps.find((step) => step.id === journey.activePhase) ?? journey.steps[0];
  const saveIndicator = getSaveIndicator(saveStatus);

  return (
    <div className="cbs-studio lds-shell lds-guided-shell">
      {toast ? (
        <section
          className={`lds-studio-toast${toast.kind === "error" ? " error" : ""}`}
          role="alert"
        >
          {toast.message}
        </section>
      ) : null}

      <section className="card lds-studio-toolbar">
        <div className="lds-studio-toolbar-main">
          <div className="lds-studio-toolbar-copy">
            <span className="badge">Lesson Design Studio</span>
            <nav
              className="lds-toolbar-breadcrumbs"
              aria-label="Lesson design studio steps"
            >
              {journey.steps.map((step) => (
                <span
                  key={step.id}
                  className={`lds-toolbar-breadcrumb ${
                    step.id === journey.activePhase
                      ? "current"
                      : step.status === "complete"
                        ? "complete"
                        : ""
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </nav>
            <p className="lds-hero-eyebrow">{eyebrow}</p>
            <h1 className="lds-hero-title">{title}</h1>
            <p className="lds-hero-copy">{body}</p>
          </div>

          <div className="lds-studio-toolbar-meta">
            <div className={`lds-save-indicator ${saveIndicator.tone}`} role="status" aria-live="polite">
              <span className="lds-save-indicator-dot" aria-hidden="true" />
              <div>
                <strong>{saveIndicator.label}</strong>
                <small>{saveIndicator.detail}</small>
              </div>
            </div>
            <span className={statusClassName}>{statusLabel}</span>
            <span className="lds-updated-at">{updatedAtLabel}</span>
          </div>
        </div>
      </section>

      <div className="lds-guided-workbench">
        <aside className="card lds-guided-rail">
          <div className="lds-guided-rail-copy">
            <p className="lds-section-eyebrow">Workspace map</p>
            <h2 className="lds-section-title">Move step by step</h2>
            <p className="lds-section-copy">
              Use the left rail to jump between phases while keeping your current
              focus, blockers, and draft health in view.
            </p>
          </div>

          <nav className="lds-guided-pill-row" aria-label="Studio steps">
            {journey.steps.map((step) => (
              <StepPill
                key={step.id}
                step={step}
                isActive={step.id === journey.activePhase}
                onClick={() => onPhaseChange(step.id)}
              />
            ))}
          </nav>

          <div className="lds-guided-rail-summary">
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

          {heroActions ? <div className="lds-guided-rail-actions">{heroActions}</div> : null}
        </aside>

        <div className="lds-guided-main">
          <section className="card lds-guided-hero">
            <div className="lds-guided-hero-top">
              <div className="lds-guided-hero-copy">
                <p className="lds-section-eyebrow">Current focus</p>
                <h2 className="lds-section-title">{activeStep.headline}</h2>
                <p className="lds-section-copy">{activeStep.whyItMatters}</p>
              </div>

              <div className="lds-guided-status-stack">
                <span className={statusClassName}>{statusLabel}</span>
                {getSavePill(saveStatus)}
              </div>
            </div>

            <div className="lds-guided-hero-grid">
              <div className="lds-guided-focus-card accent">
                <p className="lds-section-eyebrow">Recommended next move</p>
                <h3 className="lds-section-title">{journey.recommendedAction}</h3>
                <p className="lds-section-copy">
                  {journey.blockers.length > 0
                    ? journey.blockers[0]
                    : "You have cleared the blockers for this step. Keep building with the same momentum."}
                </p>
              </div>
              <div className="lds-guided-focus-card">
                <p className="lds-section-eyebrow">Step status</p>
                <h3 className="lds-section-title">{activeStep.label}</h3>
                <p className="lds-section-copy">{activeStep.recommendedAction}</p>
              </div>
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

          <div className="lds-guided-editor">{children}</div>
        </div>
      </div>
    </div>
  );
}
