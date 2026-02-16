"use client";

import { useState, useRef } from "react";
import {
  createLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
  duplicateLessonPlan,
} from "@/lib/lesson-plan-actions";
import { ActivityType } from "@prisma/client";

interface Activity {
  id: string;
  title: string;
  description: string | null;
  type: ActivityType;
  durationMin: number;
  sortOrder: number;
  resources: string | null;
  notes: string | null;
}

interface Plan {
  id: string;
  title: string;
  description: string | null;
  courseId: string | null;
  classTemplateId: string | null;
  classTemplateTitle: string | null;
  totalMinutes: number;
  authorName: string;
  isTemplate: boolean;
  updatedAt: string;
  activities: Activity[];
}

interface Course {
  id: string;
  title: string;
}

interface ClassTemplateOption {
  id: string;
  title: string;
  interestArea: string;
  createdByName: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; color: string; icon: string }[] = [
  { value: "WARM_UP", label: "Warm Up", color: "#f59e0b", icon: "\u2600" },
  { value: "INSTRUCTION", label: "Instruction", color: "#3b82f6", icon: "\uD83D\uDCDA" },
  { value: "PRACTICE", label: "Practice", color: "#22c55e", icon: "\u270D" },
  { value: "DISCUSSION", label: "Discussion", color: "#8b5cf6", icon: "\uD83D\uDCAC" },
  { value: "ASSESSMENT", label: "Assessment", color: "#ef4444", icon: "\uD83D\uDCCB" },
  { value: "BREAK", label: "Break", color: "#6b7280", icon: "\u2615" },
  { value: "REFLECTION", label: "Reflection", color: "#ec4899", icon: "\uD83D\uDCAD" },
  { value: "GROUP_WORK", label: "Group Work", color: "#14b8a6", icon: "\uD83D\uDC65" },
];

function getActivityConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find((t) => t.value === type) ?? ACTIVITY_TYPES[0];
}

function generateId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function LessonPlanBuilder({
  plans,
  courses,
  templates,
  initialTemplateId,
}: {
  plans: Plan[];
  courses: Course[];
  templates: ClassTemplateOption[];
  initialTemplateId: string;
}) {
  const validInitialTemplateId = templates.some((template) => template.id === initialTemplateId)
    ? initialTemplateId
    : "";
  const [view, setView] = useState<"list" | "builder">("list");
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Builder state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [classTemplateId, setClassTemplateId] = useState(validInitialTemplateId);
  const [isTemplate, setIsTemplate] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingActivityIdx, setEditingActivityIdx] = useState<number | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  function resetBuilder() {
    setTitle("");
    setDescription("");
    setCourseId("");
    setClassTemplateId(validInitialTemplateId);
    setIsTemplate(false);
    setActivities([]);
    setEditingPlan(null);
    setEditingActivityIdx(null);
  }

  function openBuilder(plan?: Plan) {
    if (plan) {
      setEditingPlan(plan);
      setTitle(plan.title);
      setDescription(plan.description ?? "");
      setCourseId(plan.courseId ?? "");
      setClassTemplateId(plan.classTemplateId ?? "");
      setIsTemplate(plan.isTemplate);
      setActivities(plan.activities.map((a) => ({ ...a })));
    } else {
      resetBuilder();
    }
    setView("builder");
  }

  function addActivity(type: ActivityType) {
    const config = getActivityConfig(type);
    const newActivity: Activity = {
      id: generateId(),
      title: config.label,
      description: null,
      type,
      durationMin: type === "BREAK" ? 5 : 10,
      sortOrder: activities.length,
      resources: null,
      notes: null,
    };
    setActivities([...activities, newActivity]);
    setEditingActivityIdx(activities.length);
  }

  function updateActivity(idx: number, updates: Partial<Activity>) {
    setActivities(
      activities.map((a, i) => (i === idx ? { ...a, ...updates } : a))
    );
  }

  function removeActivity(idx: number) {
    setActivities(activities.filter((_, i) => i !== idx));
    setEditingActivityIdx(null);
  }

  function handleDragStart(idx: number) {
    dragItem.current = idx;
  }

  function handleDragEnter(idx: number) {
    dragOverItem.current = idx;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...activities];
    const draggedItem = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, draggedItem);
    dragItem.current = null;
    dragOverItem.current = null;
    setActivities(items.map((a, i) => ({ ...a, sortOrder: i })));
  }

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeLabel =
    hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  async function handleSave() {
    const formData = new FormData();
    if (editingPlan) {
      formData.set("planId", editingPlan.id);
    }
    formData.set("title", title);
    formData.set("description", description);
    formData.set("courseId", courseId);
    formData.set("classTemplateId", classTemplateId);
    formData.set("isTemplate", isTemplate ? "true" : "false");
    formData.set(
      "activities",
      JSON.stringify(
        activities.map((a, i) => ({
          title: a.title,
          description: a.description,
          type: a.type,
          durationMin: a.durationMin,
          sortOrder: i,
          resources: a.resources,
          notes: a.notes,
        }))
      )
    );

    if (editingPlan) {
      await updateLessonPlan(formData);
    } else {
      await createLessonPlan(formData);
    }

    resetBuilder();
    setView("list");
  }

  // Compute running timeline
  let runningTime = 0;
  const timeline = activities.map((a) => {
    const start = runningTime;
    runningTime += a.durationMin;
    return { start, end: runningTime };
  });

  if (view === "builder") {
    return (
      <div>
        {/* Builder header */}
        <div className="lp-builder-header">
          <div>
            <input
              className="lp-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson Plan Title..."
            />
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{ marginTop: 8 }}
            />
          </div>
          <div className="lp-builder-meta">
            <select
              className="input"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              style={{ marginTop: 0, maxWidth: 240 }}
            >
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select
              className="input"
              value={classTemplateId}
              onChange={(e) => setClassTemplateId(e.target.value)}
              style={{ marginTop: 0, maxWidth: 240 }}
            >
              <option value="">No linked curriculum</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title} ({template.interestArea})
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
              />
              Save as template
            </label>
          </div>
        </div>

        {/* Timer bar */}
        <div className="lp-timer-bar">
          <div className="lp-timer-total">
            Total: <strong>{timeLabel}</strong> ({activities.length} activities)
          </div>
          {totalMinutes > 0 && (
            <div className="lp-timer-visual">
              {activities.map((a, i) => {
                const config = getActivityConfig(a.type);
                const widthPercent = (a.durationMin / totalMinutes) * 100;
                return (
                  <div
                    key={a.id}
                    className="lp-timer-segment"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: config.color,
                    }}
                    title={`${config.label}: ${a.durationMin}m`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Activity palette */}
        <div className="lp-palette">
          <span className="lp-palette-label">Add activity:</span>
          {ACTIVITY_TYPES.map((type) => (
            <button
              key={type.value}
              className="lp-palette-btn"
              onClick={() => addActivity(type.value)}
              style={{ borderColor: type.color }}
            >
              <span>{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>

        {/* Activity list */}
        <div className="lp-activities">
          {activities.length === 0 ? (
            <div className="lp-empty">
              Click an activity type above to start building your lesson plan.
            </div>
          ) : (
            activities.map((activity, idx) => {
              const config = getActivityConfig(activity.type);
              const isEditing = editingActivityIdx === idx;
              const t = timeline[idx];

              return (
                <div
                  key={activity.id}
                  className={`lp-activity-card ${isEditing ? "editing" : ""}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div
                    className="lp-activity-stripe"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="lp-activity-content">
                    <div className="lp-activity-header">
                      <div className="lp-activity-drag-handle">
                        <span style={{ cursor: "grab", fontSize: 16, color: "var(--gray-400)" }}>
                          &#x2261;
                        </span>
                      </div>
                      <span className="lp-activity-icon" style={{ backgroundColor: config.color }}>
                        {config.icon}
                      </span>
                      {isEditing ? (
                        <input
                          className="lp-activity-title-input"
                          value={activity.title}
                          onChange={(e) => updateActivity(idx, { title: e.target.value })}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="lp-activity-title"
                          onClick={() => setEditingActivityIdx(idx)}
                        >
                          {activity.title}
                        </span>
                      )}
                      <div className="lp-activity-time">
                        <span className="lp-activity-timeline">
                          {t.start}m - {t.end}m
                        </span>
                        <div className="lp-activity-duration">
                          <button
                            className="lp-duration-btn"
                            onClick={() => updateActivity(idx, { durationMin: Math.max(1, activity.durationMin - 5) })}
                          >
                            -
                          </button>
                          <span className="lp-duration-value">{activity.durationMin}m</span>
                          <button
                            className="lp-duration-btn"
                            onClick={() => updateActivity(idx, { durationMin: activity.durationMin + 5 })}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        className="lp-activity-remove"
                        onClick={() => removeActivity(idx)}
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>

                    {isEditing && (
                      <div className="lp-activity-details">
                        <label className="form-row" style={{ fontSize: 12 }}>
                          Description
                          <textarea
                            className="input"
                            value={activity.description ?? ""}
                            onChange={(e) => updateActivity(idx, { description: e.target.value || null })}
                            rows={2}
                            placeholder="What will students do?"
                          />
                        </label>
                        <div className="grid two">
                          <label className="form-row" style={{ fontSize: 12 }}>
                            Resources / Materials
                            <input
                              className="input"
                              value={activity.resources ?? ""}
                              onChange={(e) => updateActivity(idx, { resources: e.target.value || null })}
                              placeholder="Handouts, slides, links..."
                            />
                          </label>
                          <label className="form-row" style={{ fontSize: 12 }}>
                            Notes
                            <input
                              className="input"
                              value={activity.notes ?? ""}
                              onChange={(e) => updateActivity(idx, { notes: e.target.value || null })}
                              placeholder="Teacher notes..."
                            />
                          </label>
                        </div>
                        <button
                          className="button small outline"
                          onClick={() => setEditingActivityIdx(null)}
                          style={{ marginTop: 8, width: "auto" }}
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Save/Cancel */}
        <div className="lp-builder-actions">
          <button
            className="button small"
            onClick={handleSave}
            disabled={!title.trim() || activities.length === 0}
            style={{ marginTop: 0 }}
          >
            {editingPlan ? "Save Changes" : "Create Lesson Plan"}
          </button>
          <button
            className="button small outline"
            onClick={() => { resetBuilder(); setView("list"); }}
            style={{ marginTop: 0 }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Your Lesson Plans ({plans.length})
        </div>
        <button
          className="button small"
          onClick={() => openBuilder()}
          style={{ marginTop: 0 }}
        >
          + New Lesson Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="card">
          <p className="empty">
            No lesson plans yet. Click &quot;+ New Lesson Plan&quot; to build your first one.
          </p>
        </div>
      ) : (
        <div className="lp-plan-grid">
          {plans.map((plan) => {
            const courseTitle = courses.find((c) => c.id === plan.courseId)?.title;
            return (
              <div key={plan.id} className="lp-plan-card">
                <div className="lp-plan-card-header">
                  <h3 style={{ margin: 0, fontSize: 15 }}>{plan.title}</h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    {plan.isTemplate && (
                      <span className="pill pill-small pill-purple">Template</span>
                    )}
                    <span className="pill pill-small pill-info">{plan.totalMinutes}m</span>
                  </div>
                </div>
                {plan.description && (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
                    {plan.description}
                  </p>
                )}
                {courseTitle && (
                  <p style={{ fontSize: 12, color: "var(--ypp-purple)", fontWeight: 600, margin: "6px 0 0" }}>
                    {courseTitle}
                  </p>
                )}
                {plan.classTemplateTitle && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                    Linked curriculum: {plan.classTemplateTitle}
                  </p>
                )}

                {/* Activity mini-timeline */}
                {plan.activities.length > 0 && (
                  <div className="lp-mini-timeline">
                    {plan.activities.map((a) => {
                      const config = getActivityConfig(a.type);
                      const widthPercent = plan.totalMinutes > 0
                        ? (a.durationMin / plan.totalMinutes) * 100
                        : 0;
                      return (
                        <div
                          key={a.id}
                          className="lp-mini-segment"
                          style={{ width: `${widthPercent}%`, backgroundColor: config.color }}
                          title={`${a.title} (${a.durationMin}m)`}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="lp-plan-card-meta">
                  <span>{plan.activities.length} activities</span>
                  <span>{plan.authorName}</span>
                  <span>{new Date(plan.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="lp-plan-card-actions">
                  <button
                    className="button small"
                    onClick={() => openBuilder(plan)}
                    style={{ marginTop: 0 }}
                  >
                    Edit
                  </button>
                  <form action={duplicateLessonPlan} style={{ display: "inline" }}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="button small outline" type="submit" style={{ marginTop: 0 }}>
                      Duplicate
                    </button>
                  </form>
                  <form
                    action={deleteLessonPlan}
                    style={{ display: "inline" }}
                    onSubmit={(e) => {
                      if (!confirm(`Delete "${plan.title}"?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="button small danger" type="submit" style={{ marginTop: 0 }}>
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
