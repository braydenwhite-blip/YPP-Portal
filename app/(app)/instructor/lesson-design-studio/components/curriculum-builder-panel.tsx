"use client";

import { useState } from "react";
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

type EnergyLevel = "HIGH" | "MEDIUM" | "LOW";

type AtHomeAssignmentType =
  | "REFLECTION_PROMPT"
  | "PRACTICE_TASK"
  | "QUIZ"
  | "PRE_READING";

interface AtHomeAssignment {
  type: AtHomeAssignmentType;
  title: string;
  description: string;
}

interface WeekActivity {
  id: string;
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string | null;
  resources: string | null;
  notes: string | null;
  sortOrder: number;
  materials: string | null;
  differentiationTips: string | null;
  energyLevel: EnergyLevel | null;
  standardsTags: string[];
  rubric: string | null;
}

interface WeekPlan {
  id: string;
  weekNumber: number;
  title: string;
  classDurationMin: number;
  activities: WeekActivity[];
  objective: string | null;
  teacherPrepNotes: string | null;
  materialsChecklist: string[];
  atHomeAssignment: AtHomeAssignment | null;
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
  onDuplicateWeek: (weekId: string) => void;
  onAddActivity: (weekId: string, activity: Omit<WeekActivity, "id" | "sortOrder">) => void;
  onRemoveActivity: (weekId: string, activityId: string) => void;
  onUpdateActivity: (weekId: string, activityId: string, fields: Partial<WeekActivity>) => void;
  onReorderActivities: (weekId: string, activeId: string, overId: string) => void;
  onMoveActivityToWeek: (fromWeekId: string, activityId: string, toWeekId: string) => void;
  onOpenDrawer: (weekId: string, activityId: string) => void;
  onOpenTemplates: (weekId: string) => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onExportPdf: (type: "student" | "instructor") => void;
  onSubmit: () => void;
  isSubmitted: boolean;
}

/* ── Constants ─────────────────────────────────────────────── */

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

const AT_HOME_TYPES: Array<{
  value: AtHomeAssignmentType;
  label: string;
  icon: string;
}> = [
  { value: "REFLECTION_PROMPT", label: "Reflection Prompt",     icon: "✍" },
  { value: "PRACTICE_TASK",     label: "Practice Task",         icon: "🎯" },
  { value: "QUIZ",              label: "Quiz / Knowledge Check", icon: "📝" },
  { value: "PRE_READING",       label: "Pre-Reading / Video",   icon: "📖" },
];

const ENERGY_LEVELS: Array<{
  value: EnergyLevel;
  label: string;
  icon: string;
  color: string;
}> = [
  { value: "LOW",    label: "Low Energy",    icon: "🧘", color: "#3b82f6" },
  { value: "MEDIUM", label: "Medium Energy", icon: "🎯", color: "#f59e0b" },
  { value: "HIGH",   label: "High Energy",   icon: "⚡", color: "#ef4444" },
];

const FINANCIAL_TAGS = [
  "Budgeting", "Saving", "Credit", "Investing",
  "Banking", "Spending", "Insurance", "Taxes",
];

const SEL_TAGS = [
  "Self-Awareness", "Self-Management", "Social Awareness",
  "Relationship Skills", "Decision Making",
];

/* ── Helpers ───────────────────────────────────────────────── */

function getActivityConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find((t) => t.value === type) ?? ACTIVITY_TYPES[0];
}

/* ── HelpTooltip ───────────────────────────────────────────── */

function HelpTooltip({ tip }: { tip: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="cbs-help-tooltip-wrapper" style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="cbs-help-tooltip-btn"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label="Help"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid #94a3b8",
          background: "transparent",
          color: "#94a3b8",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
          marginLeft: 4,
          padding: 0,
          verticalAlign: "middle",
        }}
      >
        ?
      </button>
      {open && (
        <span
          className="cbs-help-tooltip-popover"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1e293b",
            color: "#f1f5f9",
            fontSize: 12,
            borderRadius: 6,
            padding: "6px 10px",
            whiteSpace: "normal",
            width: 220,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}
        >
          {tip}
        </span>
      )}
    </span>
  );
}

/* ── SortableActivity ──────────────────────────────────────── */

interface SortableActivityProps {
  activity: WeekActivity;
  weekId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateActivity: (weekId: string, activityId: string, fields: Partial<WeekActivity>) => void;
  onRemoveActivity: (weekId: string, activityId: string) => void;
  allWeeks: WeekPlan[];
  onMoveToWeek: (toWeekId: string) => void;
}

function SortableActivity({
  activity,
  weekId,
  isExpanded,
  onToggle,
  onUpdateActivity,
  onRemoveActivity,
  allWeeks,
  onMoveToWeek,
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

  const [customTagInput, setCustomTagInput] = useState("");

  function update(fields: Partial<WeekActivity>) {
    onUpdateActivity(weekId, activity.id, fields);
  }

  function toggleTag(tag: string) {
    const current = activity.standardsTags ?? [];
    if (current.includes(tag)) {
      update({ standardsTags: current.filter((t) => t !== tag) });
    } else {
      update({ standardsTags: [...current, tag] });
    }
  }

  function addCustomTag() {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    const current = activity.standardsTags ?? [];
    if (!current.includes(trimmed)) {
      update({ standardsTags: [...current, trimmed] });
    }
    setCustomTagInput("");
  }

  const otherWeeks = allWeeks.filter((w) => w.id !== weekId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cbs-activity-item${isExpanded ? " cbs-activity-expanded" : ""}`}
    >
      {/* Row */}
      <div className="cbs-activity-row">
        <span
          className="cbs-activity-drag-handle"
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
        >
          ⠿
        </span>

        <button
          type="button"
          className="cbs-activity-expand-btn"
          onClick={onToggle}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            fontSize: 12,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          {isExpanded ? "▼" : "▶"}
        </button>

        <span
          className="cbs-activity-type-badge"
          style={{
            background: `${config.color}22`,
            color: config.color,
            border: `1px solid ${config.color}44`,
            borderRadius: 12,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {config.icon} {config.label}
        </span>

        <span
          className="cbs-activity-title"
          title={activity.title}
          style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}
        >
          {activity.title}
        </span>

        {/* Duration trio */}
        <span className="cbs-activity-duration-trio" style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            onClick={() => update({ durationMin: Math.max(1, activity.durationMin - 1) })}
            style={{ background: "none", border: "1px solid #334155", borderRadius: 4, width: 20, height: 20, cursor: "pointer", fontSize: 12, lineHeight: 1, color: "#94a3b8", padding: 0 }}
            aria-label="Decrease duration"
          >
            −
          </button>
          <span style={{ minWidth: 36, textAlign: "center", fontSize: 12, color: "#e2e8f0" }}>
            {activity.durationMin}m
          </span>
          <button
            type="button"
            onClick={() => update({ durationMin: activity.durationMin + 1 })}
            style={{ background: "none", border: "1px solid #334155", borderRadius: 4, width: 20, height: 20, cursor: "pointer", fontSize: 12, lineHeight: 1, color: "#94a3b8", padding: 0 }}
            aria-label="Increase duration"
          >
            +
          </button>
        </span>

        <button
          className="cbs-activity-delete-btn"
          onClick={() => onRemoveActivity(weekId, activity.id)}
          type="button"
          aria-label="Remove activity"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
        >
          ×
        </button>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="cbs-activity-detail" style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #1e293b" }}>

          {/* Title input */}
          <input
            className="cbs-expand-title-input"
            value={activity.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Activity title..."
            style={{ fontSize: 15, fontWeight: 600, padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", width: "100%", boxSizing: "border-box" }}
          />

          {/* Description */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
              What will students do? Describe the activity in detail.
            </label>
            <textarea
              rows={4}
              value={activity.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Describe what students will do during this activity..."
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Materials */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
              Materials Needed
            </label>
            <textarea
              rows={2}
              value={activity.materials ?? ""}
              onChange={(e) => update({ materials: e.target.value })}
              placeholder="e.g., printed worksheets, markers, index cards..."
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Energy Level */}
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
              Energy Level
              <HelpTooltip tip="How much movement and engagement does this activity require?" />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {ENERGY_LEVELS.map((el) => {
                const isSelected = activity.energyLevel === el.value;
                return (
                  <button
                    key={el.value}
                    type="button"
                    onClick={() => update({ energyLevel: isSelected ? null : el.value })}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: `1px solid ${isSelected ? el.color : "#334155"}`,
                      background: isSelected ? `${el.color}22` : "transparent",
                      color: isSelected ? el.color : "#94a3b8",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {el.icon} {el.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Differentiation Tips */}
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
              Differentiation Tips
              <HelpTooltip tip="Strategies to support struggling students or challenge advanced learners in the same activity." />
            </label>
            <textarea
              rows={2}
              value={activity.differentiationTips ?? ""}
              onChange={(e) => update({ differentiationTips: e.target.value })}
              placeholder="How to support struggling students or challenge advanced ones..."
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Standards Tags */}
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
              Standards Alignment
              <HelpTooltip tip="Tag competencies this activity aligns to." />
            </label>

            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Financial Literacy</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {FINANCIAL_TAGS.map((tag) => {
                  const selected = (activity.standardsTags ?? []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        border: `1px solid ${selected ? "#3b82f6" : "#334155"}`,
                        background: selected ? "#3b82f622" : "transparent",
                        color: selected ? "#3b82f6" : "#94a3b8",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>SEL Competencies</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {SEL_TAGS.map((tag) => {
                  const selected = (activity.standardsTags ?? []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        border: `1px solid ${selected ? "#8b5cf6" : "#334155"}`,
                        background: selected ? "#8b5cf622" : "transparent",
                        color: selected ? "#8b5cf6" : "#94a3b8",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom tag input */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                placeholder="Add custom tag..."
                style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 12 }}
              />
              <button
                type="button"
                onClick={addCustomTag}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
              >
                Add
              </button>
            </div>

            {/* Selected tags */}
            {(activity.standardsTags ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(activity.standardsTags ?? []).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#e2e8f0",
                      fontSize: 11,
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 12, lineHeight: 1, padding: 0 }}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rubric (Assessment only) */}
          {activity.type === "ASSESSMENT" && (
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                Rubric / Grading Criteria
              </label>
              <textarea
                rows={3}
                value={activity.rubric ?? ""}
                onChange={(e) => update({ rubric: e.target.value })}
                placeholder="Describe how this will be graded or evaluated..."
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Resources */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
              Resources (links, handouts, tools)
            </label>
            <textarea
              rows={2}
              value={activity.resources ?? ""}
              onChange={(e) => update({ resources: e.target.value })}
              placeholder="Links, handouts, or tools for this activity..."
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
              Instructor Notes
            </label>
            <textarea
              rows={2}
              value={activity.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Private notes for you as the instructor..."
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Move to Another Week */}
          {otherWeeks.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Move to Week:
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    onMoveToWeek(e.target.value);
                  }
                }}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 12 }}
              >
                <option value="" disabled>Select week...</option>
                {otherWeeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    Week {w.weekNumber}: {w.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── WeekDetailSection ─────────────────────────────────────── */

interface WeekDetailSectionProps {
  week: WeekPlan;
  onUpdateWeek: (weekId: string, field: string, value: any) => void;
}

function WeekDetailSection({ week, onUpdateWeek }: WeekDetailSectionProps) {
  const [atHomeEnabled, setAtHomeEnabled] = useState(!!week.atHomeAssignment);

  function handleAtHomeToggle(enabled: boolean) {
    setAtHomeEnabled(enabled);
    if (!enabled) {
      onUpdateWeek(week.id, "atHomeAssignment", null);
    } else {
      onUpdateWeek(week.id, "atHomeAssignment", {
        type: "REFLECTION_PROMPT",
        title: "",
        description: "",
      });
    }
  }

  function handleChecklist(index: number, value: string) {
    const next = [...(week.materialsChecklist ?? [])];
    next[index] = value;
    onUpdateWeek(week.id, "materialsChecklist", next);
  }

  function handleAddChecklistItem() {
    onUpdateWeek(week.id, "materialsChecklist", [...(week.materialsChecklist ?? []), ""]);
  }

  function handleRemoveChecklistItem(index: number) {
    onUpdateWeek(week.id, "materialsChecklist", (week.materialsChecklist ?? []).filter((_, i) => i !== index));
  }

  return (
    <div className="cbs-week-detail-section" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #1e293b" }}>

      {/* Week Objective */}
      <div>
        <label style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
          Week Objective
          <HelpTooltip tip="A specific, measurable goal for this single class session" />
        </label>
        <input
          value={week.objective ?? ""}
          onChange={(e) => onUpdateWeek(week.id, "objective", e.target.value)}
          placeholder="What will students be able to do after this class?"
          style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, boxSizing: "border-box" }}
        />
      </div>

      {/* Teacher Prep Notes */}
      <div>
        <label style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
          Teacher Prep Notes
          <HelpTooltip tip="Things you need to prepare before class — copies to print, room arrangement, supplies to gather, etc." />
        </label>
        <textarea
          rows={3}
          value={week.teacherPrepNotes ?? ""}
          onChange={(e) => onUpdateWeek(week.id, "teacherPrepNotes", e.target.value)}
          placeholder="What do you need to prepare before class? e.g., print 30 copies of worksheet, set up group tables..."
          style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
      </div>

      {/* Materials Checklist */}
      <div>
        <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
          Materials Checklist
        </label>
        {(week.materialsChecklist ?? []).map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <input
              value={item}
              onChange={(e) => handleChecklist(i, e.target.value)}
              placeholder={`Item ${i + 1}...`}
              style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 12 }}
            />
            <button
              type="button"
              onClick={() => handleRemoveChecklistItem(i)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
              aria-label="Remove item"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddChecklistItem}
          style={{ fontSize: 12, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
        >
          + Add Item
        </button>
      </div>

      {/* At-Home Assignment */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: atHomeEnabled ? 10 : 0 }}>
          <label style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={atHomeEnabled}
              onChange={(e) => handleAtHomeToggle(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            At-Home Assignment
          </label>
        </div>

        {atHomeEnabled && week.atHomeAssignment && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 4 }}>
            <select
              value={week.atHomeAssignment.type}
              onChange={(e) =>
                onUpdateWeek(week.id, "atHomeAssignment", {
                  ...week.atHomeAssignment,
                  type: e.target.value as AtHomeAssignmentType,
                })
              }
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13 }}
            >
              {AT_HOME_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            <input
              value={week.atHomeAssignment.title}
              onChange={(e) =>
                onUpdateWeek(week.id, "atHomeAssignment", {
                  ...week.atHomeAssignment,
                  title: e.target.value,
                })
              }
              placeholder="Assignment title..."
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13 }}
            />
            <textarea
              rows={3}
              value={week.atHomeAssignment.description}
              onChange={(e) =>
                onUpdateWeek(week.id, "atHomeAssignment", {
                  ...week.atHomeAssignment,
                  description: e.target.value,
                })
              }
              placeholder="Describe the assignment..."
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 13, resize: "vertical" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ProgressBar ───────────────────────────────────────────── */

interface ProgressBarProps {
  title: string;
  outcomes: string[];
  weeklyPlans: WeekPlan[];
}

function ProgressBar({ title, outcomes, weeklyPlans }: ProgressBarProps) {
  const checks = [
    {
      label: "Curriculum has a title",
      pass: title.trim().length > 0,
    },
    {
      label: "At least one learning outcome",
      pass: outcomes.filter((o) => o.trim()).length >= 1,
    },
    {
      label: "All weeks have activities",
      pass: weeklyPlans.length > 0 && weeklyPlans.every((w) => w.activities.length > 0),
    },
    {
      label: "At least one week has an objective",
      pass: weeklyPlans.some((w) => w.objective?.trim()),
    },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  const pct = (passCount / 4) * 100;

  return (
    <div className="cbs-progress-section" style={{ marginTop: 12 }}>
      <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#22c55e",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {checks.map((c) => (
          <span
            key={c.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 12,
              border: `1px solid ${c.pass ? "#22c55e44" : "#334155"}`,
              background: c.pass ? "#22c55e11" : "transparent",
              color: c.pass ? "#22c55e" : "#64748b",
            }}
          >
            {c.pass ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── SubmitModal ───────────────────────────────────────────── */

interface SubmitModalProps {
  title: string;
  outcomes: string[];
  weeklyPlans: WeekPlan[];
  onClose: () => void;
  onSubmit: () => void;
}

function SubmitModal({ title, outcomes, weeklyPlans, onClose, onSubmit }: SubmitModalProps) {
  const checks = [
    {
      label: "Curriculum has a title",
      pass: title.trim().length > 0,
    },
    {
      label: "At least 2 learning outcomes",
      pass: outcomes.filter((o) => o.trim()).length >= 2,
    },
    {
      label: "At least 2 weeks planned",
      pass: weeklyPlans.length >= 2,
    },
    {
      label: "All weeks have at least one activity",
      pass: weeklyPlans.length > 0 && weeklyPlans.every((w) => w.activities.length > 0),
    },
  ];

  const allPass = checks.every((c) => c.pass);

  return (
    <div
      className="cbs-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="cbs-modal"
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 28,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#f1f5f9", fontWeight: 700 }}>
          Submit Curriculum
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
          Check that your curriculum meets all requirements before submitting.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {checks.map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: c.pass ? "#22c55e11" : "#ef444411",
                border: `1px solid ${c.pass ? "#22c55e33" : "#ef444433"}`,
              }}
            >
              <span style={{ fontSize: 16, color: c.pass ? "#22c55e" : "#ef4444" }}>
                {c.pass ? "✓" : "✗"}
              </span>
              <span style={{ fontSize: 13, color: c.pass ? "#86efac" : "#fca5a5" }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "transparent",
              color: "#94a3b8",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {allPass ? "Cancel" : "Go back and fix"}
          </button>
          {allPass && (
            <button
              type="button"
              onClick={() => { onSubmit(); onClose(); }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#22c55e",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Everything looks good! Submit Curriculum
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ExportPdfDropdown ─────────────────────────────────────── */

interface ExportPdfDropdownProps {
  onExportPdf: (type: "student" | "instructor") => void;
}

function ExportPdfDropdown({ onExportPdf }: ExportPdfDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="cbs-btn cbs-btn-secondary"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ display: "flex", alignItems: "center", gap: 4 }}
      >
        Export PDF <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            minWidth: 200,
            overflow: "hidden",
            zIndex: 100,
          }}
        >
          <button
            type="button"
            onClick={() => { onExportPdf("student"); setOpen(false); }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "none",
              border: "none",
              color: "#e2e8f0",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Student View (clean schedule)
          </button>
          <button
            type="button"
            onClick={() => { onExportPdf("instructor"); setOpen(false); }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "none",
              border: "none",
              color: "#e2e8f0",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Instructor Guide (full details)
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

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
  onDuplicateWeek,
  onAddActivity,
  onRemoveActivity,
  onUpdateActivity,
  onReorderActivities,
  onMoveActivityToWeek,
  onOpenDrawer,
  onOpenTemplates,
  saveStatus,
  onExportPdf,
  onSubmit,
  isSubmitted,
}: CurriculumBuilderPanelProps) {
  /* ── Local state ───────────────────────────────────────────── */
  const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());
  const [expandedWeekIds, setExpandedWeekIds] = useState<Set<string>>(new Set());
  const [showSubmitModal, setShowSubmitModal] = useState(false);

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
    onUpdate("outcomes", outcomes.filter((_, i) => i !== index));
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
      materials: null,
      differentiationTips: null,
      energyLevel: null,
      standardsTags: [],
      rubric: null,
    });
  }

  function toggleActivityExpand(activityId: string) {
    setExpandedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  }

  function toggleWeekExpand(weekId: string) {
    setExpandedWeekIds((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) {
        next.delete(weekId);
      } else {
        next.add(weekId);
      }
      return next;
    });
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <>
      {showSubmitModal && (
        <SubmitModal
          title={title}
          outcomes={outcomes}
          weeklyPlans={weeklyPlans}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={onSubmit}
        />
      )}

      <div className="cbs-builder-layout" style={{ display: "grid", gridTemplateColumns: "56px 1fr" }}>

        {/* ── Week Sidebar ───────────────────────────────────── */}
        <div
          className="cbs-week-sidebar"
          style={{
            position: "sticky",
            top: 16,
            alignSelf: "start",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            paddingTop: 8,
          }}
        >
          {weeklyPlans.map((week) => (
            <button
              key={week.id}
              type="button"
              onClick={() =>
                document
                  .getElementById(`cbs-week-${week.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              title={`Week ${week.weekNumber}: ${week.title}`}
            >
              W{week.weekNumber}
            </button>
          ))}
        </div>

        {/* ── Main content ───────────────────────────────────── */}
        <div className="cbs-builder-panel">

          {/* ── Header ─────────────────────────────────────── */}
          <div className="cbs-builder-header" style={{ padding: "20px 20px 0" }}>
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

            {/* Progress Bar */}
            <ProgressBar title={title} outcomes={outcomes} weeklyPlans={weeklyPlans} />
          </div>

          {/* ── Weeks ──────────────────────────────────────── */}
          {weeklyPlans.map((week) => {
            const totalMin = week.activities.reduce((sum, a) => sum + a.durationMin, 0);
            const isOverTime = totalMin > week.classDurationMin;
            const isWeekDetailExpanded = expandedWeekIds.has(week.id);

            return (
              <div
                key={week.id}
                id={`cbs-week-${week.id}`}
                className="cbs-week-section"
              >
                {/* Week header */}
                <div className="cbs-week-header">
                  <span className="cbs-week-label">Week {week.weekNumber}</span>

                  <input
                    className="cbs-week-title-input"
                    value={week.title}
                    onChange={(e) => onUpdateWeek(week.id, "title", e.target.value)}
                    placeholder="Week title..."
                  />

                  {/* Class duration - editable inline */}
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8" }}>
                    <input
                      type="number"
                      min={1}
                      value={week.classDurationMin}
                      onChange={(e) =>
                        onUpdateWeek(week.id, "classDurationMin", Math.max(1, Number(e.target.value)))
                      }
                      style={{
                        width: 48,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: "1px solid #334155",
                        background: "#0f172a",
                        color: "#e2e8f0",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                      aria-label="Class duration in minutes"
                    />
                    <span>min class</span>
                  </span>

                  <span
                    className={`cbs-week-time-stat${isOverTime ? " cbs-time-warning" : ""}`}
                    style={{ color: isOverTime ? "#f59e0b" : "#22c55e", fontSize: 12 }}
                  >
                    {isOverTime && "⚠ "}
                    {totalMin}m / {week.classDurationMin}m
                  </span>

                  {/* Week detail toggle */}
                  <button
                    type="button"
                    className="cbs-week-detail-toggle"
                    onClick={() => toggleWeekExpand(week.id)}
                    aria-label={isWeekDetailExpanded ? "Collapse week details" : "Expand week details"}
                    style={{
                      background: "none",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#94a3b8",
                      fontSize: 11,
                      padding: "3px 8px",
                    }}
                  >
                    {isWeekDetailExpanded ? "▼" : "▶"} Details
                  </button>

                  {/* Duplicate week */}
                  <button
                    type="button"
                    className="cbs-week-dup-btn"
                    onClick={() => onDuplicateWeek(week.id)}
                    aria-label="Duplicate week"
                    style={{
                      background: "none",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#94a3b8",
                      fontSize: 11,
                      padding: "3px 8px",
                    }}
                  >
                    ⧉ Duplicate
                  </button>

                  <button
                    className="cbs-week-delete-btn"
                    onClick={() => onRemoveWeek(week.id)}
                    type="button"
                    aria-label="Remove week"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
                  >
                    ×
                  </button>
                </div>

                {/* Week detail section (collapsible) */}
                {isWeekDetailExpanded && (
                  <WeekDetailSection week={week} onUpdateWeek={onUpdateWeek} />
                )}

                {/* Time bar */}
                <div
                  className="cbs-time-bar"
                  style={{ display: "flex", height: 8, background: "#1e293b", overflow: "hidden", margin: "0 16px", borderRadius: 4 }}
                >
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
                          height: "100%",
                          backgroundColor: config.color,
                          transition: "width 0.2s ease",
                        }}
                        title={`${activity.title} (${activity.durationMin}m)`}
                      />
                    );
                  })}
                </div>

                {/* Activities with DnD */}
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(week.id)}
                >
                  <SortableContext
                    items={week.activities.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="cbs-activities-list" style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {week.activities.map((activity) => (
                        <SortableActivity
                          key={activity.id}
                          activity={activity}
                          weekId={week.id}
                          isExpanded={expandedActivityIds.has(activity.id)}
                          onToggle={() => toggleActivityExpand(activity.id)}
                          onUpdateActivity={onUpdateActivity}
                          onRemoveActivity={onRemoveActivity}
                          allWeeks={weeklyPlans}
                          onMoveToWeek={(toWeekId) => {
                            onMoveActivityToWeek(week.id, activity.id, toWeekId);
                            // Collapse if it was expanded
                            setExpandedActivityIds((prev) => {
                              const next = new Set(prev);
                              next.delete(activity.id);
                              return next;
                            });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Quick add chips */}
                <div className="cbs-add-activity-row" style={{ padding: "8px 16px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
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

          {/* ── Footer ───────────────────────────────────────── */}
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
                <span className="cbs-save-status cbs-save-saved">✓ Auto-saved</span>
              )}
              {saveStatus === "error" && (
                <span className="cbs-save-status cbs-save-error">Save failed</span>
              )}
            </div>

            <div className="cbs-footer-right">
              <ExportPdfDropdown onExportPdf={onExportPdf} />

              {isSubmitted ? (
                <span className="cbs-submitted-badge">✓ Submitted</span>
              ) : (
                <button
                  className="cbs-btn cbs-btn-primary"
                  onClick={() => setShowSubmitModal(true)}
                  type="button"
                >
                  Submit Curriculum
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
