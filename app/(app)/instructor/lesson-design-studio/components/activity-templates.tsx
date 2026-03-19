"use client";

import { useEffect } from "react";
import type { ActivityType } from "../types";
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
        {/* Header */}
        <div className="cbs-templates-header">
          <h2 className="cbs-templates-title">Activity Templates</h2>
          <button className="cbs-templates-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="cbs-templates-body">
          {ACTIVITY_TEMPLATE_CATEGORIES.map((category) => (
            <section key={category.label} className="cbs-templates-category">
              <h3 className="cbs-templates-category-header">
                <span className="cbs-templates-category-icon">{category.icon}</span>
                {category.label}
              </h3>

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

      <style jsx>{`
        .cbs-templates-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
        }

        .cbs-templates-modal {
          width: 720px;
          max-width: 92vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: rgba(28, 28, 34, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 8px 24px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          color: #f2f2f7;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        }

        .cbs-templates-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          flex-shrink: 0;
        }

        .cbs-templates-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .cbs-templates-close {
          background: none;
          border: none;
          color: rgba(242, 242, 247, 0.5);
          font-size: 24px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          transition: color 220ms ease;
        }

        .cbs-templates-close:hover {
          color: #f2f2f7;
        }

        .cbs-templates-body {
          overflow-y: auto;
          padding: 16px 24px 24px;
          flex: 1;
        }

        .cbs-templates-category {
          margin-bottom: 24px;
        }

        .cbs-templates-category:last-child {
          margin-bottom: 0;
        }

        .cbs-templates-category-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(242, 242, 247, 0.5);
          margin: 0 0 12px;
        }

        .cbs-templates-category-icon {
          font-size: 16px;
        }

        .cbs-templates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .cbs-templates-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          padding: 14px 16px;
          background: rgba(48, 48, 56, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          color: #f2f2f7;
          font-family: inherit;
          transition: background 180ms ease, border-color 180ms ease, transform 120ms ease;
        }

        .cbs-templates-card:hover {
          background: rgba(60, 60, 70, 0.8);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .cbs-templates-card:active {
          transform: translateY(0);
        }

        .cbs-templates-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .cbs-templates-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          letter-spacing: 0.02em;
        }

        .cbs-templates-duration {
          font-size: 12px;
          color: rgba(242, 242, 247, 0.4);
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }

        .cbs-templates-card-title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
        }

        .cbs-templates-card-desc {
          font-size: 12px;
          line-height: 1.45;
          color: rgba(242, 242, 247, 0.45);
        }

        @media (max-width: 600px) {
          .cbs-templates-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default ActivityTemplates;
