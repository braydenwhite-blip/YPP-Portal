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
  isModalOpen?: boolean;
  toast?:
    | {
        kind: "error" | "success";
        message: string;
      }
    | null;
  journey: GuidedStudioJourney;
  onPhaseChange: (phase: StudioPhase) => void;
  toolbarActions?: ReactNode;
  heroActions?: ReactNode;
  children: ReactNode;
}

function getSaveIndicator(saveStatus: GuidedStudioShellProps["saveStatus"]) {
  switch (saveStatus) {
    case "saving":
      return { tone: "saving", label: "Saving..." };
    case "saved":
      return { tone: "saved", label: "Saved ✓" };
    case "error":
      return { tone: "error", label: "Save error" };
    default:
      return { tone: "idle", label: "Autosave on" };
  }
}

function StepRailItem({
  step,
  index,
  isActive,
  onClick,
}: {
  step: GuidedStudioStep;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusChip =
    step.status === "complete"
      ? "Complete"
      : isActive
        ? "In progress"
        : "Upcoming";

  return (
    <button
      type="button"
      className={`lds-rail-step ${step.status}${isActive ? " active" : ""}`}
      onClick={onClick}
      aria-current={isActive ? "step" : undefined}
    >
      <span
        className={`lds-rail-step-badge ${step.status}${isActive ? " active" : ""}`}
        aria-hidden="true"
      >
        {step.status === "complete" ? "✓" : index + 1}
      </span>
      <span className="lds-rail-step-label">{step.label}</span>
      <span className={`lds-rail-step-chip ${step.status}${isActive ? " active" : ""}`}>
        {statusChip}
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
  isModalOpen = false,
  toast,
  journey,
  onPhaseChange,
  toolbarActions,
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

      <section
        className={`lds-studio-toolbar${isScrolled ? " scrolled" : ""}${
          isModalOpen ? " modal-open" : ""
        }`}
      >
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
                  <button
                    type="button"
                    className={`lds-toolbar-phase-button ${
                      step.id === journey.activePhase
                        ? "current"
                        : step.status === "complete"
                          ? "complete"
                          : ""
                    }`}
                    aria-current={step.id === journey.activePhase ? "step" : undefined}
                    onClick={() => onPhaseChange(step.id)}
                  >
                    <span className="lds-toolbar-phase-num" aria-hidden="true">
                      {step.status === "complete" ? "✓" : index + 1}
                    </span>
                    <span>{step.label}</span>
                  </button>
                  {index < journey.steps.length - 1 ? (
                    <span className="lds-toolbar-phase-divider" aria-hidden="true" />
                  ) : null}
                </span>
              ))}
            </nav>
          </div>

          <div className="lds-toolbar-region lds-toolbar-region-right">
            {toolbarActions ? (
              <div className="lds-toolbar-actions">{toolbarActions}</div>
            ) : null}
            <div
              className={`lds-save-indicator ${saveIndicator.tone}`}
              role="status"
              aria-live="polite"
            >
              <span className="lds-save-indicator-dot" aria-hidden="true" />
              <strong>{saveIndicator.label}</strong>
            </div>
            <span className={statusClassName}>{statusLabel}</span>
          </div>
        </div>
      </section>

      <div className="lds-guided-workbench">
        <aside className="lds-guided-rail">
          <nav className="lds-guided-pill-row" aria-label="Studio steps">
            {journey.steps.map((step, index) => (
              <StepRailItem
                key={step.id}
                step={step}
                index={index}
                isActive={step.id === journey.activePhase}
                onClick={() => onPhaseChange(step.id)}
              />
            ))}
          </nav>

          <div className="lds-guided-rail-summary">
            <div className="lds-progress-cell">
              <span className="lds-stat-label">Sessions built</span>
              <strong className="lds-stat-value">{sessionsBuiltLabel}</strong>
            </div>
            <div className="lds-progress-cell">
              <span className="lds-stat-label">Readiness</span>
              <strong className="lds-stat-value">{understandingLabel}</strong>
            </div>
          </div>

          {heroActions ? (
            <div className="lds-guided-rail-actions">{heroActions}</div>
          ) : null}
        </aside>

        <div className="lds-guided-main">
          <div className="lds-phase-context-strip">
            <span className="lds-phase-context-label">{eyebrow}</span>
            <span className="lds-phase-context-sep" aria-hidden="true">·</span>
            <span className="lds-phase-context-desc">{journey.recommendedAction}</span>
          </div>

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
