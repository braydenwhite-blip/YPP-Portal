"use client";

import { useState } from "react";
import type { WeekActivity } from "../types";
import {
  ENERGY_LEVEL_CONFIG,
  FINANCIAL_TAGS,
  SEL_TAGS,
  getActivityTypeConfig,
  ACTIVITY_TYPE_CONFIG,
} from "./activity-template-data";

interface ActivityDetailDrawerProps {
  activity: WeekActivity | null;
  readOnly?: boolean;
  onUpdate: (id: string, fields: Partial<WeekActivity>) => void;
  onClose: () => void;
}

export function ActivityDetailDrawer({
  activity,
  readOnly = false,
  onUpdate,
  onClose,
}: ActivityDetailDrawerProps) {
  const [customTagInput, setCustomTagInput] = useState("");
  const currentType = activity ? getActivityTypeConfig(activity.type) : null;

  function handleChange(
    field: keyof WeekActivity,
    value: string | number | string[] | null
  ) {
    if (readOnly || !activity) return;
    onUpdate(activity.id, { [field]: value });
  }

  function handleDurationStep(delta: number) {
    if (readOnly || !activity) return;
    const next = Math.max(1, activity.durationMin + delta);
    onUpdate(activity.id, { durationMin: next });
  }

  function toggleTag(tag: string) {
    if (readOnly || !activity) return;
    const current = activity.standardsTags ?? [];
    if (current.includes(tag)) {
      handleChange(
        "standardsTags",
        current.filter((item) => item !== tag)
      );
      return;
    }

    handleChange("standardsTags", [...current, tag]);
  }

  function addCustomTag() {
    if (readOnly || !activity) return;
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!activity.standardsTags.includes(trimmed)) {
      handleChange("standardsTags", [...activity.standardsTags, trimmed]);
    }
    setCustomTagInput("");
  }

  if (!activity) return null;

  return (
    <>
      <div className="cbs-drawer-backdrop" onClick={onClose} />
      <div className="cbs-drawer cbs-drawer-open">
        {/* Header */}
        <div className="cbs-drawer-header">
          <div className="cbs-drawer-header-title">
            <span className="cbs-drawer-header-icon">{currentType?.icon ?? "📝"}</span>
            <span>Edit Activity</span>
          </div>
          <button className="cbs-drawer-close" onClick={onClose} aria-label="Close drawer">×</button>
        </div>

        {/* Body */}
        <div className="cbs-drawer-body">
          {/* Title */}
          <label className="cbs-drawer-label">Title</label>
          <input
            className="cbs-drawer-input"
            type="text"
            value={activity.title}
            readOnly={readOnly}
            onChange={(e) => handleChange("title", e.target.value)}
          />

          {/* Type */}
          <label className="cbs-drawer-label">Type</label>
          <select
            className="cbs-drawer-select"
            value={activity.type}
            disabled={readOnly}
            onChange={(e) => handleChange("type", e.target.value)}
          >
            {ACTIVITY_TYPE_CONFIG.map((t) => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>

          {/* Duration */}
          <label className="cbs-drawer-label">Duration (min)</label>
          <div className="cbs-drawer-duration">
            <button className="cbs-drawer-duration-btn" disabled={readOnly} onClick={() => handleDurationStep(-1)} aria-label="Decrease">−</button>
            <input
              className="cbs-drawer-duration-input"
              type="number"
              min={1}
              value={activity.durationMin}
              readOnly={readOnly}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) handleChange("durationMin", v);
              }}
            />
            <button className="cbs-drawer-duration-btn" disabled={readOnly} onClick={() => handleDurationStep(1)} aria-label="Increase">+</button>
          </div>

          {/* Description */}
          <label className="cbs-drawer-label">Description</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={4}
            value={activity.description ?? ""}
            readOnly={readOnly}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="What will students do in this activity?"
          />

          {/* Materials */}
          <label className="cbs-drawer-label">Materials Needed</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={2}
            value={activity.materials ?? ""}
            readOnly={readOnly}
            onChange={(e) => handleChange("materials", e.target.value || null)}
            placeholder="e.g., printed worksheets, markers, index cards..."
          />

          {/* Energy Level */}
          <label className="cbs-drawer-label">Energy Level</label>
          <div style={{ display: "flex", gap: 6 }}>
            {ENERGY_LEVEL_CONFIG.map((level) => (
              <button
                key={level.value}
                type="button"
                disabled={readOnly}
                onClick={() =>
                  handleChange(
                    "energyLevel",
                    activity.energyLevel === level.value ? null : level.value
                  )
                }
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: `1px solid ${activity.energyLevel === level.value ? level.color : "rgba(255,255,255,0.1)"}`,
                  background: activity.energyLevel === level.value ? `${level.color}22` : "transparent",
                  color: activity.energyLevel === level.value ? level.color : "rgba(242,242,247,0.5)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {level.icon} {level.label}
              </button>
            ))}
          </div>

          {/* Differentiation Tips */}
          <label className="cbs-drawer-label">Differentiation Tips</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={2}
            value={activity.differentiationTips ?? ""}
            readOnly={readOnly}
            onChange={(e) => handleChange("differentiationTips", e.target.value || null)}
            placeholder="How to support struggling students or challenge advanced ones..."
          />

          <label className="cbs-drawer-label">Standards Tags</label>
          <div className="cbs-drawer-tag-group">
            {FINANCIAL_TAGS.map((tag) => {
              const selected = activity.standardsTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`cbs-drawer-tag${selected ? " active" : ""}`}
                  disabled={readOnly}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="cbs-drawer-tag-group">
            {SEL_TAGS.map((tag) => {
              const selected = activity.standardsTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`cbs-drawer-tag${selected ? " active alt" : ""}`}
                  disabled={readOnly}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="cbs-drawer-custom-tag-row">
            <input
              className="cbs-drawer-input"
              type="text"
              value={customTagInput}
              readOnly={readOnly}
              onChange={(event) => setCustomTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Add custom tag"
            />
            <button type="button" className="button secondary" disabled={readOnly} onClick={addCustomTag}>
              Add
            </button>
          </div>

          {/* Rubric (Assessment only) */}
          {activity.type === "ASSESSMENT" && (
            <>
              <label className="cbs-drawer-label">Rubric / Grading Criteria</label>
              <textarea
                className="cbs-drawer-textarea"
                rows={3}
                value={activity.rubric ?? ""}
                readOnly={readOnly}
                onChange={(e) => handleChange("rubric", e.target.value || null)}
                placeholder="Describe how this will be graded or evaluated..."
              />
            </>
          )}

          {/* Resources */}
          <label className="cbs-drawer-label">Resources</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={2}
            value={activity.resources ?? ""}
            readOnly={readOnly}
            onChange={(e) => handleChange("resources", e.target.value || null)}
          />

          {/* Notes */}
          <label className="cbs-drawer-label">Instructor Notes</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={2}
            value={activity.notes ?? ""}
            readOnly={readOnly}
            onChange={(e) => handleChange("notes", e.target.value || null)}
          />
        </div>
      </div>
    </>
  );
}
