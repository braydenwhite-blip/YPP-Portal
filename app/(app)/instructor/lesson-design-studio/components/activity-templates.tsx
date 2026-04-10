"use client";

import { useEffect } from "react";
import {
  ACTIVITY_TEMPLATE_CATEGORIES,
  getActivityTypeConfig,
  type ActivityTemplateData,
} from "./activity-template-data";

interface ActivityTemplatesProps {
  open: boolean;
  onClose: () => void;
  onInsert: (template: ActivityTemplateData) => void;
}

export function ActivityTemplates({ open, onClose, onInsert }: ActivityTemplatesProps) {
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

  function handleCardClick(template: ActivityTemplateData) {
    onInsert(template);
    onClose();
  }

  return (
    <div className="cbs-templates-overlay" onClick={onClose}>
      <div
        className="cbs-templates-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Activity templates"
      >
        <div className="cbs-templates-header">
          <div>
            <p className="cbs-templates-eyebrow">Activity library</p>
            <h2 className="cbs-templates-title">Drop ready-made lesson moves into this session</h2>
            <p className="cbs-templates-copy">
              Pick a template to insert the bones of an activity, then tune the details in the properties panel.
            </p>
            <div className="cbs-templates-meta">
              <span>{ACTIVITY_TEMPLATE_CATEGORIES.length} curated categories</span>
              <span aria-hidden="true">•</span>
              <span>
                {ACTIVITY_TEMPLATE_CATEGORIES.reduce(
                  (count, category) => count + category.templates.length,
                  0
                )}{" "}
                starter activities
              </span>
            </div>
          </div>
          <button
            className="cbs-templates-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="cbs-templates-body">
          {ACTIVITY_TEMPLATE_CATEGORIES.map((category) => (
            <section key={category.label} className="cbs-templates-category">
              <div className="cbs-templates-category-header">
                <div className="cbs-templates-category-title-row">
                  <span className="cbs-templates-category-icon">{category.icon}</span>
                  <h3 className="cbs-templates-category-title">{category.label}</h3>
                </div>
                <p className="cbs-templates-category-copy">
                  {category.templates.length} options to shape this part of the lesson arc.
                </p>
              </div>

              <div className="cbs-templates-grid">
                {category.templates.map((template) => {
                  const config = getActivityTypeConfig(template.type);
                  return (
                    <button
                      key={template.title}
                      className="cbs-templates-card"
                      onClick={() => handleCardClick(template)}
                    >
                      <div className="cbs-templates-card-top">
                        <span
                          className="cbs-templates-badge"
                          style={{ background: config.color + "22", color: config.color }}
                        >
                          {config.label}
                        </span>
                        <span className="cbs-templates-duration">
                          {template.durationMin}m
                        </span>
                      </div>
                      <div className="cbs-templates-card-title">{template.title}</div>
                      <div className="cbs-templates-card-desc">{template.description}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
