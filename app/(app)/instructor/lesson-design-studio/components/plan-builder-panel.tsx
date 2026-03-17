"use client";

import { useState, useTransition, useCallback } from "react";
import { studioCreateLessonPlan, studioUpdateLessonPlan } from "@/lib/studio-actions";
import { OsWindow } from "./os-window";

type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

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

interface SavedPlan {
  id: string;
  title: string;
  description: string | null;
  totalMinutes: number;
  classTemplateId: string | null;
  isTemplate: boolean;
  updatedAt: string;
  activities: Activity[];
}

interface LessonBlueprint {
  index: number;
  topic: string;
  lessonGoal: string;
  warmUpHook: string;
  miniLesson: string;
  guidedPractice: string;
  independentBuild: string;
  exitTicket: string;
  materialsTools: string;
}

interface PlanBuilderPanelProps {
  lesson: LessonBlueprint | null; // null = applicant mode (no curriculum)
  lessonIndex: number;
  totalLessons: number;
  classTemplateId: string | null;
  existingPlan: SavedPlan | null;
  onSaved: (planId: string, title: string, totalMinutes: number) => void;
  onSelectLesson: (index: number) => void;
  allLessons: Array<LessonBlueprint | null>;
  savedPlansByLesson: Map<number, SavedPlan>;
}

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

function generateId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function seedActivitiesFromBlueprint(blueprint: LessonBlueprint): Activity[] {
  const activities: Activity[] = [];
  let order = 0;

  if (blueprint.warmUpHook) {
    activities.push({ id: generateId(), title: blueprint.warmUpHook.slice(0, 60), description: blueprint.warmUpHook, type: "WARM_UP", durationMin: 8, sortOrder: order++, resources: null, notes: null });
  }
  if (blueprint.miniLesson) {
    activities.push({ id: generateId(), title: blueprint.miniLesson.slice(0, 60), description: blueprint.miniLesson, type: "INSTRUCTION", durationMin: 15, sortOrder: order++, resources: null, notes: blueprint.materialsTools || null });
  }
  if (blueprint.guidedPractice) {
    activities.push({ id: generateId(), title: blueprint.guidedPractice.slice(0, 60), description: blueprint.guidedPractice, type: "PRACTICE", durationMin: 12, sortOrder: order++, resources: null, notes: null });
  }
  if (blueprint.independentBuild) {
    activities.push({ id: generateId(), title: blueprint.independentBuild.slice(0, 60), description: blueprint.independentBuild, type: "PRACTICE", durationMin: 12, sortOrder: order++, resources: null, notes: null });
  }
  if (blueprint.exitTicket) {
    activities.push({ id: generateId(), title: blueprint.exitTicket.slice(0, 60), description: blueprint.exitTicket, type: "REFLECTION", durationMin: 6, sortOrder: order++, resources: null, notes: null });
  }

  // If blueprint had nothing, start with a minimal set
  if (activities.length === 0) {
    activities.push(
      { id: generateId(), title: "Warm Up", description: null, type: "WARM_UP", durationMin: 8, sortOrder: 0, resources: null, notes: null },
      { id: generateId(), title: "Main Instruction", description: null, type: "INSTRUCTION", durationMin: 20, sortOrder: 1, resources: null, notes: null },
      { id: generateId(), title: "Student Practice", description: null, type: "PRACTICE", durationMin: 15, sortOrder: 2, resources: null, notes: null },
      { id: generateId(), title: "Exit Reflection", description: null, type: "REFLECTION", durationMin: 7, sortOrder: 3, resources: null, notes: null },
    );
  }

  return activities;
}

export function PlanBuilderPanel({
  lesson,
  lessonIndex,
  totalLessons,
  classTemplateId,
  existingPlan,
  onSaved,
  onSelectLesson,
  allLessons,
  savedPlansByLesson,
}: PlanBuilderPanelProps) {
  const defaultTitle = lesson ? lesson.topic : "My Lesson Plan";
  const defaultDesc = lesson?.lessonGoal || "";

  const [title, setTitle] = useState(existingPlan?.title ?? defaultTitle);
  const [description, setDescription] = useState(existingPlan?.description ?? defaultDesc);
  const [activities, setActivities] = useState<Activity[]>(
    existingPlan?.activities ?? (lesson ? seedActivitiesFromBlueprint(lesson) : [
      { id: generateId(), title: "Warm Up", description: null, type: "WARM_UP", durationMin: 8, sortOrder: 0, resources: null, notes: null },
      { id: generateId(), title: "Main Instruction", description: null, type: "INSTRUCTION", durationMin: 20, sortOrder: 1, resources: null, notes: null },
      { id: generateId(), title: "Student Practice", description: null, type: "PRACTICE", durationMin: 15, sortOrder: 2, resources: null, notes: null },
      { id: generateId(), title: "Exit Reflection", description: null, type: "REFLECTION", durationMin: 7, sortOrder: 3, resources: null, notes: null },
    ])
  );
  const [savedPlanId, setSavedPlanId] = useState<string | null>(existingPlan?.id ?? null);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalMinutes = activities.reduce((s, a) => s + a.durationMin, 0);

  const addActivity = useCallback((type: ActivityType) => {
    const config = getActivityConfig(type);
    setActivities((prev) => [
      ...prev,
      {
        id: generateId(),
        title: config.label,
        description: null,
        type,
        durationMin: config.defaultDuration,
        sortOrder: prev.length,
        resources: null,
        notes: null,
      },
    ]);
  }, []);

  const updateActivity = useCallback(
    (id: string, field: Partial<Activity>) => {
      setActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...field } : a))
      );
    },
    []
  );

  const removeActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id).map((a, i) => ({ ...a, sortOrder: i })));
  }, []);

  const adjustDuration = useCallback((id: string, delta: number) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, durationMin: Math.max(1, a.durationMin + delta) } : a
      )
    );
  }, []);

  const handleSave = () => {
    setSaveError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("title", title);
        formData.set("description", description);
        if (classTemplateId) formData.set("classTemplateId", classTemplateId);
        formData.set("isTemplate", "false");
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

        let resultId: string;
        if (savedPlanId) {
          formData.set("planId", savedPlanId);
          const result = await studioUpdateLessonPlan(formData);
          resultId = result.id;
        } else {
          const result = await studioCreateLessonPlan(formData);
          resultId = result.id;
          setSavedPlanId(resultId);
        }

        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 3000);
        onSaved(resultId, title, totalMinutes);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  return (
    <div className="os-builder-layout">
      {/* Sidebar — lesson navigator */}
      <div className="os-builder-sidebar">
        <div className="os-builder-sidebar-title">
          {totalLessons === 1 ? "Your Plan" : `${totalLessons} Lessons`}
        </div>
        {Array.from({ length: totalLessons }).map((_, i) => {
          const bl = allLessons[i];
          const saved = savedPlansByLesson.get(i);
          const isActive = i === lessonIndex;
          return (
            <button
              key={i}
              className={`os-lesson-nav-item ${isActive ? "active" : ""} ${saved ? "done" : ""}`}
              onClick={() => onSelectLesson(i)}
              type="button"
            >
              <span className="os-lesson-nav-num">{saved ? "✓" : i + 1}</span>
              <span className="os-lesson-nav-label">
                {bl?.topic || `Lesson ${i + 1}`}
              </span>
              <span className="os-lesson-nav-status">
                {saved ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main builder */}
      <div className="os-builder-main">
        <div className="os-window os-builder-window">
          {/* Builder header */}
          <div className="os-builder-header">
            <div className="os-builder-lesson-num">
              {totalLessons === 1 ? "Your Lesson Plan" : `Lesson ${lessonIndex + 1} of ${totalLessons}`}
            </div>
            <input
              className="os-builder-lesson-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson title..."
            />
            <textarea
              className="os-builder-lesson-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the goal of this lesson..."
              rows={2}
            />
          </div>

          {/* Activities */}
          <div className="os-builder-body">
            <div className="os-activities-list">
              {activities.map((activity) => {
                const config = getActivityConfig(activity.type);
                return (
                  <div key={activity.id} className="os-activity-item">
                    <span className="os-activity-drag-handle">⠿</span>

                    <span
                      className="os-activity-type-badge"
                      style={{
                        background: `${config.color}22`,
                        color: config.color,
                        border: `1px solid ${config.color}44`,
                      }}
                    >
                      {config.icon} {config.label}
                    </span>

                    <input
                      className="os-activity-name-input"
                      value={activity.title}
                      onChange={(e) => updateActivity(activity.id, { title: e.target.value })}
                      placeholder="Activity title..."
                    />

                    <div className="os-activity-dur">
                      <button
                        className="os-activity-dur-btn"
                        onClick={() => adjustDuration(activity.id, -5)}
                        type="button"
                        aria-label="Decrease duration"
                      >
                        −
                      </button>
                      <span className="os-activity-dur-val">{activity.durationMin}m</span>
                      <button
                        className="os-activity-dur-btn"
                        onClick={() => adjustDuration(activity.id, 5)}
                        type="button"
                        aria-label="Increase duration"
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="os-activity-delete-btn"
                      onClick={() => removeActivity(activity.id)}
                      type="button"
                      aria-label="Remove activity"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add activity chips */}
            <div className="os-add-activity-row">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  className="os-add-activity-chip"
                  onClick={() => addActivity(t.value)}
                  type="button"
                  style={{ borderColor: `${t.color}44`, color: t.color }}
                >
                  {t.icon} + {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="os-builder-footer">
            <div className="os-builder-total">
              <strong>{totalMinutes}</strong> min total · {activities.length} activities
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {saveError && (
                <span style={{ fontSize: 12, color: "var(--os-red)" }}>{saveError}</span>
              )}
              {justSaved && (
                <span className="os-save-status">✓ Saved</span>
              )}
              <button
                className="os-builder-save-btn"
                onClick={handleSave}
                disabled={isPending || !title.trim()}
                type="button"
              >
                {isPending ? "Saving…" : savedPlanId ? "Update Plan" : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
