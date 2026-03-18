"use client";

import { useCallback } from "react";

type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

type EnergyLevel = "HIGH" | "MEDIUM" | "LOW";

interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string | null;
  resources: string | null;
  notes: string | null;
  materials: string | null;
  differentiationTips: string | null;
  energyLevel: EnergyLevel | null;
  standardsTags: string[];
  rubric: string | null;
}

interface ActivityDetailDrawerProps {
  activity: Activity | null;
  onUpdate: (id: string, fields: Partial<Activity>) => void;
  onClose: () => void;
}

const ACTIVITY_TYPES = [
  { value: "WARM_UP",     label: "Warm Up",     color: "#f59e0b", icon: "☀" },
  { value: "INSTRUCTION", label: "Instruction", color: "#3b82f6", icon: "📚" },
  { value: "PRACTICE",    label: "Practice",    color: "#22c55e", icon: "✍" },
  { value: "DISCUSSION",  label: "Discussion",  color: "#8b5cf6", icon: "💬" },
  { value: "ASSESSMENT",  label: "Assessment",  color: "#ef4444", icon: "📋" },
  { value: "BREAK",       label: "Break",       color: "#6b7280", icon: "☕" },
  { value: "REFLECTION",  label: "Reflection",  color: "#ec4899", icon: "💭" },
  { value: "GROUP_WORK",  label: "Group Work",  color: "#14b8a6", icon: "👥" },
] as const;

const ENERGY_LEVELS = [
  { value: "LOW",    label: "Low",    icon: "🧘", color: "#3b82f6" },
  { value: "MEDIUM", label: "Medium", icon: "🎯", color: "#f59e0b" },
  { value: "HIGH",   label: "High",   icon: "⚡", color: "#ef4444" },
];

export function ActivityDetailDrawer({
  activity,
  onUpdate,
  onClose,
}: ActivityDetailDrawerProps) {
  if (!activity) return null;

  const currentType = ACTIVITY_TYPES.find((t) => t.value === activity.type);

  const handleChange = useCallback(
    (field: keyof Activity, value: string | number | string[] | null) => {
      onUpdate(activity.id, { [field]: value });
    },
    [activity.id, onUpdate]
  );

  const handleDurationStep = useCallback(
    (delta: number) => {
      const next = Math.max(1, activity.durationMin + delta);
      onUpdate(activity.id, { durationMin: next });
    },
    [activity.id, activity.durationMin, onUpdate]
  );

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
            onChange={(e) => handleChange("title", e.target.value)}
          />

          {/* Type */}
          <label className="cbs-drawer-label">Type</label>
          <select
            className="cbs-drawer-select"
            value={activity.type}
            onChange={(e) => handleChange("type", e.target.value as ActivityType)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>

          {/* Duration */}
          <label className="cbs-drawer-label">Duration (min)</label>
          <div className="cbs-drawer-duration">
            <button className="cbs-drawer-duration-btn" onClick={() => handleDurationStep(-1)} aria-label="Decrease">−</button>
            <input
              className="cbs-drawer-duration-input"
              type="number"
              min={1}
              value={activity.durationMin}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) handleChange("durationMin", v);
              }}
            />
            <button className="cbs-drawer-duration-btn" onClick={() => handleDurationStep(1)} aria-label="Increase">+</button>
          </div>

          {/* Description */}
          <label className="cbs-drawer-label">Description</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={4}
            value={activity.description ?? ""}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="What will students do in this activity?"
          />

          {/* Materials */}
          <label className="cbs-drawer-label">Materials Needed</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={2}
            value={activity.materials ?? ""}
            onChange={(e) => handleChange("materials", e.target.value || null)}
            placeholder="e.g., printed worksheets, markers, index cards..."
          />

          {/* Energy Level */}
          <label className="cbs-drawer-label">Energy Level</label>
          <div style={{ display: "flex", gap: 6 }}>
            {ENERGY_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => handleChange("energyLevel", activity.energyLevel === level.value ? null : level.value as EnergyLevel)}
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
            onChange={(e) => handleChange("differentiationTips", e.target.value || null)}
            placeholder="How to support struggling students or challenge advanced ones..."
          />

          {/* Rubric (Assessment only) */}
          {activity.type === "ASSESSMENT" && (
            <>
              <label className="cbs-drawer-label">Rubric / Grading Criteria</label>
              <textarea
                className="cbs-drawer-textarea"
                rows={3}
                value={activity.rubric ?? ""}
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
            onChange={(e) => handleChange("resources", e.target.value || null)}
          />

          {/* Notes */}
          <label className="cbs-drawer-label">Instructor Notes</label>
          <textarea
            className="cbs-drawer-textarea"
            rows={2}
            value={activity.notes ?? ""}
            onChange={(e) => handleChange("notes", e.target.value || null)}
          />
        </div>
      </div>
    </>
  );
}
