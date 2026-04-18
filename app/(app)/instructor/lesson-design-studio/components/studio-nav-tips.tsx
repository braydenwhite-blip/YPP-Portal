"use client";

import { useEffect } from "react";

interface StudioNavTipsProps {
  open: boolean;
  onClose: () => void;
  showTrainingOrientationAction: boolean;
  onMarkTrainingOrientation: () => void | Promise<void>;
}

export function StudioNavTips({
  open,
  onClose,
  showTrainingOrientationAction,
  onMarkTrainingOrientation,
}: StudioNavTipsProps) {
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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="cbs-modal-overlay"
      role="presentation"
      data-testid="nav-tips-overlay"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lds-nav-tips-title"
        className="cbs-history-modal lds-nav-tips-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cbs-history-header">
          <h3 id="lds-nav-tips-title" className="cbs-history-title">
            How to move around
          </h3>
          <button
            type="button"
            className="lds-library-close"
            onClick={onClose}
            aria-label="Close tips"
          >
            ×
          </button>
        </div>

        <div className="lds-nav-tips-body">
          <ul className="lds-simple-list lds-nav-tips-list">
            <li>
              Use the <strong>step pills</strong> under the toolbar (Start → Map → Plan → Checks →
              Submit). Each opens its own page for this draft.
            </li>
            <li>
              Edits <strong>autosave</strong>; status appears next to the toolbar actions.
            </li>
            <li>
              <strong>Library</strong> opens the examples library when you need inspiration.
            </li>
            <li>
              On each step, use the phase buttons (e.g. Plan, back to Map) inside the editor when
              you need them.
            </li>
          </ul>

          <div className="lds-nav-tips-actions">
            <button type="button" className="button" onClick={onClose}>
              Got it
            </button>
            {showTrainingOrientationAction ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => void onMarkTrainingOrientation()}
              >
                Mark training orientation done
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
