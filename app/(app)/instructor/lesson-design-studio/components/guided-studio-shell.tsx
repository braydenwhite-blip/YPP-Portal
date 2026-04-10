"use client";

import { useEffect, useState, type ReactNode } from "react";
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

function StepRailItem({
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
      className={`lds-rail-step ${step.status}${isActive ? " active" : ""}`}
      onClick={onClick}
      aria-current={isActive ? "step" : undefined}
    >
      <span className="lds-rail-step-ornament" aria-hidden="true">
        <span className={`lds-rail-step-dot ${step.status}`}>
          {step.status === "complete" ? "✓" : ""}
        </span>
        <span className={`lds-rail-step-line ${step.status}`} />
      </span>
      <span className="lds-rail-step-copy">
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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 12);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

      <section className={`lds-studio-toolbar${isScrolled ? " scrolled" : ""}`}>
        <div className="lds-studio-toolbar-main">
          <div className="lds-toolbar-region lds-toolbar-region-left">
            <div className="lds-toolbar-brand">
              <span className="lds-toolbar-brand-mark" aria-hidden="true" />
              <div className="lds-toolbar-brand-copy">
                <span className="lds-toolbar-label">Lesson Design Studio</span>
                <strong>{eyebrow}</strong>
              </div>
            </div>

            <nav
              className="lds-toolbar-breadcrumbs"
              aria-label="Lesson design studio steps"
            >
              <span className="lds-toolbar-breadcrumb-root">Studio</span>
              <span className="lds-toolbar-breadcrumb-divider" aria-hidden="true">
                /
              </span>
              <span className="lds-toolbar-breadcrumb current">
                {activeStep.label}
              </span>
            </nav>
          </div>

          <div className="lds-toolbar-region lds-toolbar-region-center">
            <nav className="lds-toolbar-phase-path" aria-label="Studio progress">
              {journey.steps.map((step, index) => (
                <span key={step.id} className="lds-toolbar-phase-item">
                  <span
                    className={`lds-toolbar-phase-button ${
                      step.id === journey.activePhase
                        ? "current"
                        : step.status === "complete"
                          ? "complete"
                          : ""
                    }`}
                    aria-current={step.id === journey.activePhase ? "step" : undefined}
                  >
                    <span className="lds-toolbar-phase-dot" aria-hidden="true" />
                    <span>{step.label}</span>
                  </span>
                  {index < journey.steps.length - 1 ? (
                    <span className="lds-toolbar-phase-divider" aria-hidden="true" />
                  ) : null}
                </span>
              ))}
            </nav>
          </div>

          <div className="lds-toolbar-region lds-toolbar-region-right">
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
        <aside className="lds-guided-rail">
          <div className="lds-guided-rail-copy">
            <p className="lds-section-eyebrow">Workspace map</p>
            <h2 className="lds-section-title">Move with clarity</h2>
            <p className="lds-section-copy">
              Keep the whole build visible while you work on one thoughtful move at
              a time.
            </p>
          </div>

          <nav className="lds-guided-pill-row" aria-label="Studio steps">
            {journey.steps.map((step) => (
              <StepRailItem
                key={step.id}
                step={step}
                isActive={step.id === journey.activePhase}
                onClick={() => onPhaseChange(step.id)}
              />
            ))}
          </nav>

          <div className="lds-guided-rail-summary">
            <div className="lds-stat-card">
              <span className="lds-stat-label">Current phase</span>
              <strong className="lds-stat-value">{currentPhaseLabel}</strong>
            </div>
            <div className="lds-stat-card">
              <span className="lds-stat-label">Session build</span>
              <strong className="lds-stat-value">{sessionsBuiltLabel}</strong>
            </div>
            <div className="lds-stat-card">
              <span className="lds-stat-label">Teaching checks</span>
              <strong className="lds-stat-value">{understandingLabel}</strong>
            </div>
            <div className="lds-stat-card">
              <span className="lds-stat-label">Open blockers</span>
              <strong className="lds-stat-value">{blockerLabel}</strong>
            </div>
          </div>

          {heroActions ? <div className="lds-guided-rail-actions">{heroActions}</div> : null}
        </aside>

        <div className="lds-guided-main">
          <section className="lds-guided-hero">
            <div className="lds-guided-hero-top">
              <div className="lds-guided-hero-copy">
                <p className="lds-section-eyebrow">Current focus</p>
                <h1 className="lds-hero-title">{title}</h1>
                <p className="lds-hero-copy">{body}</p>
              </div>

              <div className="lds-guided-status-stack">
                <span className={statusClassName}>{statusLabel}</span>
                {getSavePill(saveStatus)}
              </div>
            </div>

            <div className="lds-guided-hero-grid">
              <div className="lds-guided-focus-card accent">
                <p className="lds-section-eyebrow">Recommended next move</p>
                <h2 className="lds-section-title">{journey.recommendedAction}</h2>
                <p className="lds-section-copy">
                  {journey.blockers.length > 0
                    ? journey.blockers[0]
                    : "You have cleared the blockers for this phase. Keep the same calm momentum."}
                </p>
              </div>
              <div className="lds-guided-focus-card">
                <p className="lds-section-eyebrow">Why this matters now</p>
                <h2 className="lds-section-title">{activeStep.headline}</h2>
                <p className="lds-section-copy">{activeStep.whyItMatters}</p>
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

          <div className="lds-guided-editor">
            <div key={journey.activePhase} className="lds-guided-editor-stage">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
