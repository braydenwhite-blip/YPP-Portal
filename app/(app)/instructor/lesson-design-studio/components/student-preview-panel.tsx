"use client";

import { useEffect, type CSSProperties } from "react";
import { buildSessionLabel } from "@/lib/curriculum-draft-progress";
import type { StudioCourseConfig, WeekPlan } from "../types";
import { getActivityTypeConfig } from "./activity-template-data";
import { StudioRichContent } from "./studio-rich-editor";

interface StudentPreviewPanelProps {
  open: boolean;
  week: WeekPlan | null;
  courseConfig: StudioCourseConfig;
  onClose: () => void;
}

export function StudentPreviewPanel({
  open,
  week,
  courseConfig,
  onClose,
}: StudentPreviewPanelProps) {
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

  if (!open || !week) {
    return null;
  }

  const sessionLabel = buildSessionLabel(week, courseConfig);
  const totalMinutes = week.activities.reduce(
    (sum, activity) => sum + activity.durationMin,
    0
  );

  return (
    <div className="cbs-preview-overlay" onClick={onClose}>
      <div
        className="cbs-preview-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Student preview for ${week.title || sessionLabel}`}
      >
        <div className="cbs-preview-header">
          <div>
            <p className="cbs-preview-eyebrow">Student preview</p>
            <h2 className="cbs-preview-title">{week.title || sessionLabel}</h2>
            <p className="cbs-preview-copy">
              This is the student-facing view of the current session, including rich
              media, quiz blocks, and the full activity sequence.
            </p>
          </div>
          <button
            type="button"
            className="lds-library-close"
            onClick={onClose}
            aria-label="Close student preview"
          >
            ×
          </button>
        </div>

        <div className="cbs-preview-body">
          <div className="cbs-preview-summary">
            <div className="cbs-preview-summary-card">
              <span>Session</span>
              <strong>{sessionLabel}</strong>
            </div>
            <div className="cbs-preview-summary-card">
              <span>Planned time</span>
              <strong>{totalMinutes} min</strong>
            </div>
            <div className="cbs-preview-summary-card">
              <span>Activities</span>
              <strong>{week.activities.length}</strong>
            </div>
          </div>

          {week.objective ? (
            <section className="cbs-preview-section intro">
              <span className="cbs-preview-section-label">What students are working toward</span>
              <h3>{week.objective}</h3>
            </section>
          ) : null}

          <div className="cbs-preview-activity-list">
            {week.activities.map((activity, index) => {
              const config = getActivityTypeConfig(activity.type);
              const startMin = week.activities
                .slice(0, index)
                .reduce((sum, item) => sum + item.durationMin, 0);

              return (
                <article key={activity.id} className="cbs-preview-activity-card">
                  <div className="cbs-preview-activity-top">
                    <div className="cbs-preview-activity-meta">
                      <span
                        className="cbs-preview-activity-badge"
                        style={{ "--cbs-preview-accent": config.color } as CSSProperties}
                      >
                        {config.icon} {config.label}
                      </span>
                      <span className="cbs-preview-activity-time">
                        {startMin}-{startMin + activity.durationMin} min
                      </span>
                    </div>
                    <span className="cbs-preview-activity-duration">
                      {activity.durationMin} min
                    </span>
                  </div>

                  <h3 className="cbs-preview-activity-title">
                    {activity.title || config.label}
                  </h3>

                  <StudioRichContent
                    content={activity.description}
                    interactiveQuiz
                    emptyState="No student-facing description has been added for this activity yet."
                  />
                </article>
              );
            })}
          </div>

          {week.atHomeAssignment ? (
            <section className="cbs-preview-section">
              <span className="cbs-preview-section-label">After class</span>
              <h3>{week.atHomeAssignment.title}</h3>
              <p>{week.atHomeAssignment.description}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
