"use client";

import { useState, type CSSProperties } from "react";
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
      <div className="cbs-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="cbs-drawer cbs-drawer-open"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit activity ${activity.title || currentType?.label || ""}`}
      >
        <div className="cbs-drawer-header">
          <div className="cbs-drawer-header-stack">
            <div className="cbs-drawer-header-title">
              <span className="cbs-drawer-header-icon">{currentType?.icon ?? "📝"}</span>
              <span>{activity.title || "Edit Activity"}</span>
            </div>
            <div className="cbs-drawer-header-meta">
              <span className="cbs-drawer-chip">
                {currentType?.label ?? "Activity"}
              </span>
              <span className="cbs-drawer-chip subtle">{activity.durationMin} min</span>
            </div>
          </div>
          <button className="cbs-drawer-close" onClick={onClose} aria-label="Close drawer">
            ×
          </button>
        </div>

        <div className="cbs-drawer-body">
          <section className="cbs-drawer-section">
            <div className="cbs-drawer-section-header">
              <div>
                <p className="cbs-drawer-section-eyebrow">Basics</p>
                <h3 className="cbs-drawer-section-title">Core setup</h3>
              </div>
            </div>

            <label className="cbs-drawer-field">
              <span className="cbs-drawer-label">Title</span>
              <input
                className="cbs-drawer-input"
                type="text"
                value={activity.title}
                readOnly={readOnly}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </label>

            <div className="cbs-drawer-field-grid">
              <label className="cbs-drawer-field">
                <span className="cbs-drawer-label">Type</span>
                <select
                  className="cbs-drawer-select"
                  value={activity.type}
                  disabled={readOnly}
                  onChange={(e) => handleChange("type", e.target.value)}
                >
                  {ACTIVITY_TYPE_CONFIG.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="cbs-drawer-field">
                <span className="cbs-drawer-label">Duration (min)</span>
                <div className="cbs-drawer-duration">
                  <button
                    className="cbs-drawer-duration-btn"
                    disabled={readOnly}
                    onClick={() => handleDurationStep(-1)}
                    aria-label="Decrease"
                  >
                    −
                  </button>
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
                  <button
                    className="cbs-drawer-duration-btn"
                    disabled={readOnly}
                    onClick={() => handleDurationStep(1)}
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <label className="cbs-drawer-field">
              <span className="cbs-drawer-label">Description</span>
              <textarea
                className="cbs-drawer-textarea"
                rows={4}
                value={activity.description ?? ""}
                readOnly={readOnly}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="What will students do in this activity?"
              />
            </label>
          </section>

          <section className="cbs-drawer-section">
            <div className="cbs-drawer-section-header">
              <div>
                <p className="cbs-drawer-section-eyebrow">Student Experience</p>
                <h3 className="cbs-drawer-section-title">Energy and support</h3>
              </div>
            </div>

            <div className="cbs-drawer-field">
              <span className="cbs-drawer-label">Energy Level</span>
              <div className="cbs-drawer-energy-grid">
                {ENERGY_LEVEL_CONFIG.map((level) => {
                  const selected = activity.energyLevel === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      className={`cbs-drawer-energy-chip${selected ? " active" : ""}`}
                      disabled={readOnly}
                      onClick={() =>
                        handleChange(
                          "energyLevel",
                          selected ? null : level.value
                        )
                      }
                      style={
                        {
                          "--cbs-energy-color": level.color,
                        } as CSSProperties
                      }
                    >
                      <span>{level.icon}</span>
                      <span>{level.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="cbs-drawer-field">
              <span className="cbs-drawer-label">Differentiation Tips</span>
              <textarea
                className="cbs-drawer-textarea"
                rows={2}
                value={activity.differentiationTips ?? ""}
                readOnly={readOnly}
                onChange={(e) => handleChange("differentiationTips", e.target.value || null)}
                placeholder="How will you support students who need a scaffold or extension?"
              />
            </label>
          </section>

          <section className="cbs-drawer-section">
            <div className="cbs-drawer-section-header">
              <div>
                <p className="cbs-drawer-section-eyebrow">Planning Notes</p>
                <h3 className="cbs-drawer-section-title">Materials and resources</h3>
              </div>
            </div>

            <label className="cbs-drawer-field">
              <span className="cbs-drawer-label">Materials Needed</span>
              <textarea
                className="cbs-drawer-textarea"
                rows={2}
                value={activity.materials ?? ""}
                readOnly={readOnly}
                onChange={(e) => handleChange("materials", e.target.value || null)}
                placeholder="Example: printed worksheet, markers, sticky notes"
              />
            </label>

            <label className="cbs-drawer-field">
              <span className="cbs-drawer-label">Resources</span>
              <textarea
                className="cbs-drawer-textarea"
                rows={2}
                value={activity.resources ?? ""}
                readOnly={readOnly}
                onChange={(e) => handleChange("resources", e.target.value || null)}
                placeholder="Links, handouts, slides, or tools the instructor needs"
              />
            </label>

            <label className="cbs-drawer-field">
              <span className="cbs-drawer-label">Instructor Notes</span>
              <textarea
                className="cbs-drawer-textarea"
                rows={2}
                value={activity.notes ?? ""}
                readOnly={readOnly}
                onChange={(e) => handleChange("notes", e.target.value || null)}
                placeholder="Anything the instructor should remember while facilitating"
              />
            </label>
          </section>

          <section className="cbs-drawer-section">
            <div className="cbs-drawer-section-header">
              <div>
                <p className="cbs-drawer-section-eyebrow">Curriculum Signals</p>
                <h3 className="cbs-drawer-section-title">Tags and alignment</h3>
              </div>
            </div>

            <div className="cbs-drawer-field">
              <span className="cbs-drawer-label">Financial Literacy Tags</span>
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
            </div>

            <div className="cbs-drawer-field">
              <span className="cbs-drawer-label">SEL Tags</span>
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
              <button
                type="button"
                className="button secondary"
                disabled={readOnly}
                onClick={addCustomTag}
              >
                Add
              </button>
            </div>
          </section>

          {activity.type === "ASSESSMENT" ? (
            <section className="cbs-drawer-section">
              <div className="cbs-drawer-section-header">
                <div>
                  <p className="cbs-drawer-section-eyebrow">Assessment</p>
                  <h3 className="cbs-drawer-section-title">Rubric notes</h3>
                </div>
              </div>

              <label className="cbs-drawer-field">
                <span className="cbs-drawer-label">Rubric / Grading Criteria</span>
                <textarea
                  className="cbs-drawer-textarea"
                  rows={3}
                  value={activity.rubric ?? ""}
                  readOnly={readOnly}
                  onChange={(e) => handleChange("rubric", e.target.value || null)}
                  placeholder="Describe how this activity will be graded or evaluated"
                />
              </label>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}
