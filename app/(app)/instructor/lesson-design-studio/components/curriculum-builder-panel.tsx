"use client";

import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ── Types ─────────────────────────────────────────────────── */

type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

interface WeekActivity {
  id: string;
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string | null;
  resources: string | null;
  notes: string | null;
  sortOrder: number;
}

interface WeekPlan {
  id: string;
  weekNumber: number;
  title: string;
  classDurationMin: number;
  activities: WeekActivity[];
}

interface CurriculumBuilderPanelProps {
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  weeklyPlans: WeekPlan[];
  onUpdate: (field: string, value: any) => void;
  onUpdateWeek: (weekId: string, field: string, value: any) => void;
  onAddWeek: () => void;
  onRemoveWeek: (weekId: string) => void;
  onAddActivity: (
    weekId: string,
    activity: Omit<WeekActivity, "id" | "sortOrder">
  ) => void;
  onRemoveActivity: (weekId: string, activityId: string) => void;
  onUpdateActivity: (
    weekId: string,
    activityId: string,
    fields: Partial<WeekActivity>
  ) => void;
  onReorderActivities: (
    weekId: string,
    activeId: string,
    overId: string
  ) => void;
  onOpenDrawer: (weekId: string, activityId: string) => void;
  onOpenTemplates: (weekId: string) => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onExportPdf: () => void;
  onSubmit: () => void;
  isSubmitted: boolean;
}

/* ── Activity type config ──────────────────────────────────── */

const ACTIVITY_TYPES: Array<{
  value: ActivityType;
  label: string;
  color: string;
  icon: string;
  defaultDuration: number;
}> = [
  { value: "WARM_UP",     label: "Warm Up",     color: "#f59e0b", icon: "☀",  defaultDuration: 8  },
  { value: "INSTRUCTION", label: "Instruction", color: "#3b82f6", icon: "📚", defaultDuration: 15 },
  { value: "PRACTICE",    label: "Practice",    color: "#22c55e", icon: "✍",  defaultDuration: 12 },
  { value: "DISCUSSION",  label: "Discussion",  color: "#8b5cf6", icon: "💬", defaultDuration: 10 },
  { value: "ASSESSMENT",  label: "Assessment",  color: "#ef4444", icon: "📋", defaultDuration: 8  },
  { value: "BREAK",       label: "Break",       color: "#6b7280", icon: "☕", defaultDuration: 5  },
  { value: "REFLECTION",  label: "Reflection",  color: "#ec4899", icon: "💭", defaultDuration: 6  },
  { value: "GROUP_WORK",  label: "Group Work",  color: "#14b8a6", icon: "👥", defaultDuration: 12 },
];

function getActivityConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find((t) => t.value === type) ?? ACTIVITY_TYPES[0];
}

/* ── SortableActivity sub-component ────────────────────────── */

interface SortableActivityProps {
  activity: WeekActivity;
  weekId: string;
  onOpenDrawer: (weekId: string, activityId: string) => void;
  onRemoveActivity: (weekId: string, activityId: string) => void;
}

function SortableActivity({
  activity,
  weekId,
  onOpenDrawer,
  onRemoveActivity,
}: SortableActivityProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = getActivityConfig(activity.type);

  return (
    <div ref={setNodeRef} style={style} className="cbs-activity-item">
      <span className="cbs-activity-drag-handle" {...attributes} {...listeners}>
        ⠿
      </span>

      <span
        className="cbs-activity-type-badge"
        style={{
          background: `${config.color}22`,
          color: config.color,
          border: `1px solid ${config.color}44`,
        }}
      >
        {config.icon} {config.label}
      </span>

      <span className="cbs-activity-title" title={activity.title}>
        {activity.title}
      </span>

      <span className="cbs-activity-duration">{activity.durationMin}m</span>

      <button
        className="cbs-activity-edit-btn"
        onClick={() => onOpenDrawer(weekId, activity.id)}
        type="button"
        aria-label="Edit activity"
      >
        ✎
      </button>

      <button
        className="cbs-activity-delete-btn"
        onClick={() => onRemoveActivity(weekId, activity.id)}
        type="button"
        aria-label="Remove activity"
      >
        ×
      </button>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────── */

export function CurriculumBuilderPanel({
  title,
  description,
  interestArea,
  outcomes,
  weeklyPlans,
  onUpdate,
  onUpdateWeek,
  onAddWeek,
  onRemoveWeek,
  onAddActivity,
  onRemoveActivity,
  onUpdateActivity,
  onReorderActivities,
  onOpenDrawer,
  onOpenTemplates,
  saveStatus,
  onExportPdf,
  onSubmit,
  isSubmitted,
}: CurriculumBuilderPanelProps) {
  /* ── Helpers ───────────────────────────────────────────────── */

  function handleDragEnd(weekId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        onReorderActivities(weekId, active.id as string, over.id as string);
      }
    };
  }

  function handleOutcomeChange(index: number, value: string) {
    const next = [...outcomes];
    next[index] = value;
    onUpdate("outcomes", next);
  }

  function handleRemoveOutcome(index: number) {
    const next = outcomes.filter((_, i) => i !== index);
    onUpdate("outcomes", next);
  }

  function handleAddOutcome() {
    onUpdate("outcomes", [...outcomes, ""]);
  }

  function handleQuickAddActivity(weekId: string, type: ActivityType) {
    const config = getActivityConfig(type);
    onAddActivity(weekId, {
      title: config.label,
      type,
      durationMin: config.defaultDuration,
      description: null,
      resources: null,
      notes: null,
    });
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="cbs-builder-panel">
      {/* ── Header Section ──────────────────────────────────── */}
      <div className="cbs-builder-header">
        <input
          className="cbs-title-input"
          value={title}
          onChange={(e) => onUpdate("title", e.target.value)}
          placeholder="Name your curriculum..."
        />

        <textarea
          className="cbs-desc-input"
          value={description}
          onChange={(e) => onUpdate("description", e.target.value)}
          placeholder="What will students learn?"
          rows={3}
        />

        <input
          className="cbs-field-input"
          value={interestArea}
          onChange={(e) => onUpdate("interestArea", e.target.value)}
          placeholder="e.g., Finance, Technology, Cooking..."
        />

        {/* Learning Outcomes */}
        <div className="cbs-outcomes-section">
          <div className="cbs-outcomes-label">Learning Outcomes</div>
          {outcomes.map((outcome, i) => (
            <div key={i} className="cbs-outcome-item">
              <input
                className="cbs-outcome-input"
                value={outcome}
                onChange={(e) => handleOutcomeChange(i, e.target.value)}
                placeholder={`Outcome ${i + 1}...`}
              />
              <button
                className="cbs-outcome-remove-btn"
                onClick={() => handleRemoveOutcome(i)}
                type="button"
                aria-label="Remove outcome"
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="cbs-add-outcome-btn"
            onClick={handleAddOutcome}
            type="button"
          >
            + Add Outcome
          </button>
        </div>
      </div>

      {/* ── Weeks Section ───────────────────────────────────── */}
      {weeklyPlans.map((week) => {
        const totalMin = week.activities.reduce(
          (sum, a) => sum + a.durationMin,
          0
        );
        const isOverTime = totalMin > week.classDurationMin;

        return (
          <div key={week.id} className="cbs-week-section">
            {/* Week header */}
            <div className="cbs-week-header">
              <span className="cbs-week-label">Week {week.weekNumber}</span>

              <input
                className="cbs-week-title-input"
                value={week.title}
                onChange={(e) =>
                  onUpdateWeek(week.id, "title", e.target.value)
                }
                placeholder="Week title..."
              />

              <span
                className={`cbs-week-time-stat ${
                  isOverTime ? "cbs-time-warning" : ""
                }`}
                style={{ color: isOverTime ? "#f59e0b" : "#22c55e" }}
              >
                {isOverTime && "⚠ "}
                {totalMin}m / {week.classDurationMin}m
              </span>

              <button
                className="cbs-week-delete-btn"
                onClick={() => onRemoveWeek(week.id)}
                type="button"
                aria-label="Remove week"
              >
                ×
              </button>
            </div>

            {/* Time bar */}
            <div className="cbs-time-bar">
              {week.activities.map((activity) => {
                const config = getActivityConfig(activity.type);
                const pct =
                  week.classDurationMin > 0
                    ? (activity.durationMin / week.classDurationMin) * 100
                    : 0;
                return (
                  <div
                    key={activity.id}
                    className="cbs-time-bar-segment"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: config.color,
                    }}
                    title={`${activity.title} (${activity.durationMin}m)`}
                  />
                );
              })}
            </div>

            {/* Activities list with drag-and-drop */}
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd(week.id)}
            >
              <SortableContext
                items={week.activities.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="cbs-activities-list">
                  {week.activities.map((activity) => (
                    <SortableActivity
                      key={activity.id}
                      activity={activity}
                      weekId={week.id}
                      onOpenDrawer={onOpenDrawer}
                      onRemoveActivity={onRemoveActivity}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add activity row */}
            <div className="cbs-add-activity-row">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  className="cbs-add-activity-chip"
                  onClick={() => handleQuickAddActivity(week.id, t.value)}
                  type="button"
                  style={{ borderColor: `${t.color}44`, color: t.color }}
                >
                  {t.icon} + {t.label}
                </button>
              ))}
              <button
                className="cbs-templates-btn"
                onClick={() => onOpenTemplates(week.id)}
                type="button"
              >
                Templates
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="cbs-builder-footer">
        <div className="cbs-footer-left">
          <button
            className="cbs-btn cbs-btn-secondary"
            onClick={onAddWeek}
            type="button"
          >
            + Add Week
          </button>
        </div>

        <div className="cbs-footer-center">
          {saveStatus === "saving" && (
            <span className="cbs-save-status cbs-save-saving">Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="cbs-save-status cbs-save-saved">
              ✓ Auto-saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="cbs-save-status cbs-save-error">Save failed</span>
          )}
        </div>

        <div className="cbs-footer-right">
          <button
            className="cbs-btn cbs-btn-secondary"
            onClick={onExportPdf}
            type="button"
          >
            Export PDF
          </button>

          {isSubmitted ? (
            <span className="cbs-submitted-badge">✓ Submitted</span>
          ) : (
            <button
              className="cbs-btn cbs-btn-primary"
              onClick={onSubmit}
              type="button"
            >
              Submit Curriculum
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
