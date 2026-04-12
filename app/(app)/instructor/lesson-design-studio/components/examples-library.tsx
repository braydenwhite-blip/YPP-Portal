"use client";

import { useEffect } from "react";
import { ExampleCurriculumPanel } from "./example-curriculum-panel";
import type { ExampleWeek } from "../examples-data";
import { useBodyScrollLock } from "./use-body-scroll-lock";

interface ExamplesLibraryProps {
  open: boolean;
  activeTab: number;
  interestArea: string;
  targetLabel?: string | null;
  errorMessage?: string | null;
  autoRecommendEnabled?: boolean;
  onClose: () => void;
  onTabChange: (index: number, source?: "auto" | "user") => void;
  onImportWeek: (week: ExampleWeek) => boolean;
}

export function ExamplesLibrary({
  open,
  activeTab,
  interestArea,
  targetLabel,
  errorMessage,
  autoRecommendEnabled,
  onClose,
  onTabChange,
  onImportWeek,
}: ExamplesLibraryProps) {
  useBodyScrollLock(open);

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

  if (!open) return null;

  return (
    <div className="lds-library-overlay" onClick={onClose}>
      <div
        className="lds-library-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Examples library"
      >
        <div className="lds-library-header">
          <div>
            <p className="lds-library-eyebrow">Examples Library</p>
            <h2 className="lds-library-title">Learn the move, then adapt it</h2>
            <p className="lds-library-copy">
              These examples are here to help you see pacing, arc, and student
              experience choices that make a session teachable.
            </p>
            <div className="lds-library-meta">
              <span className="lds-library-chip">Curated exemplars</span>
              {interestArea ? (
                <span className="lds-library-chip subtle">
                  Interest area: {interestArea}
                </span>
              ) : null}
            </div>
            {targetLabel ? (
              <p className="lds-library-target">
                Import target: <strong>{targetLabel}</strong>
              </p>
            ) : null}
            {errorMessage ? (
              <p className="lds-library-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="lds-library-close"
            onClick={onClose}
            aria-label="Close examples library"
          >
            ×
          </button>
        </div>

        <div className="lds-library-body">
          <ExampleCurriculumPanel
            activeTab={activeTab}
            interestArea={interestArea}
            autoRecommendEnabled={autoRecommendEnabled}
            onTabChange={onTabChange}
            onImportWeek={onImportWeek}
          />
        </div>
      </div>
    </div>
  );
}
