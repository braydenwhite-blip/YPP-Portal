"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  MIN_ACTIVITIES_PER_SESSION,
  buildSessionLabel,
} from "@/lib/curriculum-draft-progress";
import { getLessonDesignStudioRichPreview } from "@/lib/lesson-design-studio-rich-content";
import type { StudioPhase } from "@/lib/lesson-design-studio";
import type { ExampleWeek } from "../examples-data";
import type {
  AtHomeAssignment,
  CurriculumCommentAnchor,
  CurriculumCommentRecord,
  StudioCourseConfig,
  StudioUnderstandingChecks,
  WeekActivity,
  WeekPlan,
} from "../types";
import { ActivityDetailDrawer } from "./activity-detail-drawer";
import {
  ACTIVITY_TYPE_CONFIG,
  ACTIVITY_TEMPLATE_CATEGORIES,
  AT_HOME_TYPE_CONFIG,
  getActivityTypeConfig,
} from "./activity-template-data";
import { SessionTimeline } from "./session-timeline";
import { StudioExampleSpotlight } from "./studio-example-spotlight";
import { StudioMicroChecks } from "./studio-micro-checks";

interface StudioSessionsStepProps {
  interestArea: string;
  courseConfig: StudioCourseConfig;
  weeklyPlans: WeekPlan[];
  currentUserId: string;
  canComment: boolean;
  canResolveComments: boolean;
  blockers: string[];
  understandingChecks: StudioUnderstandingChecks;
  selectedWeekId: string | null;
  isReadOnly: boolean;
  getCommentStats: (anchor: {
    anchorType: string;
    anchorId?: string | null;
    anchorField?: string | null;
  }) => {
    comments: CurriculumCommentRecord[];
    count: number;
    unresolvedCount: number;
  };
  onSelectWeek: (weekId: string) => void;
  onUpdateWeek: (weekId: string, field: string, value: unknown) => void;
  onDuplicateWeek: (weekId: string) => void;
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
  onReorderActivities: (weekId: string, activeId: string, overId: string) => void;
  onOpenTemplates: (weekId: string) => void;
  onOpenExamplesLibrary: (targetPlanId?: string | null) => void;
  onImportExampleWeek: (week: ExampleWeek, targetPlanId?: string | null) => boolean;
  onPhaseChange: (phase: StudioPhase) => void;
  onAnswerUnderstandingCheck: (questionId: string, answer: string) => void;
  onOpenComments: (anchor: CurriculumCommentAnchor) => void;
  onCreateComment: (
    anchor: CurriculumCommentAnchor,
    body: string,
    parentId?: string | null
  ) => Promise<void> | void;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
}

const QUICK_TEMPLATE_TITLES = [
  "Hook Question",
  "Mini Lesson",
  "Guided Practice",
  "Reflection Journal",
];

const QUICK_TEMPLATES = ACTIVITY_TEMPLATE_CATEGORIES.flatMap(
  (category) => category.templates
).filter((template) => QUICK_TEMPLATE_TITLES.includes(template.title));

const QUICK_ADD_ACTIVITY_VALUES: WeekActivity["type"][] = [
  "WARM_UP",
  "INSTRUCTION",
  "PRACTICE",
  "DISCUSSION",
  "REFLECTION",
];

const QUICK_ADD_ACTIVITY_TYPES = ACTIVITY_TYPE_CONFIG.filter((type) =>
  QUICK_ADD_ACTIVITY_VALUES.includes(type.value)
);

function buildActivitySeed(
  activity:
    | {
        title: string;
        type: WeekActivity["type"];
        durationMin: number;
        description: string | null;
      }
    | {
        label: string;
        value: WeekActivity["type"];
        defaultDuration: number;
      }
): Omit<WeekActivity, "id" | "sortOrder"> {
  if ("label" in activity) {
    return {
      title: activity.label,
      type: activity.value,
      durationMin: activity.defaultDuration,
      description: null,
      resources: null,
      notes: null,
      materials: null,
      differentiationTips: null,
      energyLevel: null,
      standardsTags: [],
      rubric: null,
    };
  }

  return {
    title: activity.title,
    type: activity.type,
    durationMin: activity.durationMin,
    description: activity.description,
    resources: null,
    notes: null,
    materials: null,
    differentiationTips: null,
    energyLevel: null,
    standardsTags: [],
    rubric: null,
  };
}

function buildSessionCoaching(week: WeekPlan) {
  const totalMinutes = week.activities.reduce(
    (sum, activity) => sum + activity.durationMin,
    0
  );
  const coaching: string[] = [];

  if (!week.title.trim()) {
    coaching.push("Give this session a title so the roadmap feels concrete.");
  }

  if (!(week.objective ?? "").trim()) {
    coaching.push("Name what students should be able to do by the end of this session.");
  }

  if (week.activities.length < MIN_ACTIVITIES_PER_SESSION) {
    coaching.push(
      `Build out the lesson arc with at least ${MIN_ACTIVITIES_PER_SESSION} activities.`
    );
  }

  if (totalMinutes > week.classDurationMin) {
    coaching.push(
      `This session is over time by ${totalMinutes - week.classDurationMin} minute${totalMinutes - week.classDurationMin === 1 ? "" : "s"}.`
    );
  }

  if (totalMinutes > 0 && totalMinutes < Math.round(week.classDurationMin * 0.65)) {
    coaching.push("This session may be too thin for the full time block. Consider adding practice or reflection.");
  }

  if (!week.atHomeAssignment) {
    coaching.push("Add a simple at-home move so learning continues after class.");
  }

  return coaching;
}

function sortActivities(activities: WeekActivity[]) {
  return [...activities].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function StudioSessionsStep({
  interestArea,
  courseConfig,
  weeklyPlans,
  currentUserId,
  canComment,
  canResolveComments,
  blockers,
  understandingChecks,
  selectedWeekId,
  isReadOnly,
  getCommentStats,
  onSelectWeek,
  onUpdateWeek,
  onDuplicateWeek,
  onRemoveWeek,
  onAddActivity,
  onRemoveActivity,
  onUpdateActivity,
  onReorderActivities,
  onOpenTemplates,
  onOpenExamplesLibrary,
  onImportExampleWeek,
  onPhaseChange,
  onAnswerUnderstandingCheck,
  onOpenComments,
  onCreateComment,
  onResolveComment,
  onDeleteComment,
}: StudioSessionsStepProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMaterialsChecklist, setShowMaterialsChecklist] = useState(false);

  const selectedWeek =
    weeklyPlans.find((week) => week.id === selectedWeekId) ?? weeklyPlans[0] ?? null;
  const sortedActivities = selectedWeek ? sortActivities(selectedWeek.activities) : [];
  const selectedActivity =
    sortedActivities.find((activity) => activity.id === selectedActivityId) ?? null;
  const coaching = selectedWeek ? buildSessionCoaching(selectedWeek) : [];
  const totalMinutes = sortedActivities.reduce(
    (sum, activity) => sum + activity.durationMin,
    0
  );

  useEffect(() => {
    if (!selectedWeek && weeklyPlans[0]) {
      onSelectWeek(weeklyPlans[0].id);
    }
  }, [onSelectWeek, selectedWeek, weeklyPlans]);

  useEffect(() => {
    if (!selectedWeek) return;
    if (!selectedActivityId) return;
    const activityStillExists = selectedWeek.activities.some(
      (activity) => activity.id === selectedActivityId
    );
    if (!activityStillExists) {
      setSelectedActivityId(null);
    }
  }, [selectedActivityId, selectedWeek]);

  if (!selectedWeek) {
    return null;
  }

  function moveActivity(activityId: string, direction: "up" | "down") {
    const currentIndex = sortedActivities.findIndex((activity) => activity.id === activityId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const target = sortedActivities[targetIndex];
    if (!target) return;
    onReorderActivities(selectedWeek.id, activityId, target.id);
  }

  function updateChecklist(value: string) {
    const nextChecklist = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    onUpdateWeek(selectedWeek.id, "materialsChecklist", nextChecklist);
  }

  function updateAtHomeAssignment(patch: Partial<AtHomeAssignment>) {
    const currentAssignment =
      selectedWeek.atHomeAssignment ?? {
        type: "REFLECTION_PROMPT",
        title: "",
        description: "",
      };

    onUpdateWeek(selectedWeek.id, "atHomeAssignment", {
      ...currentAssignment,
      ...patch,
    });
  }

  const materialsCount = selectedWeek.materialsChecklist.length;

  return (
    <section className="lds-step-layout">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-step-card-header">
            <div>
              <p className="lds-section-eyebrow">Step 2</p>
              <h2 className="lds-section-title">{buildSessionLabel(selectedWeek, courseConfig)}</h2>
              <p className="lds-section-copy">
                Shape a lesson arc that feels teachable, paced, and confident from opening
                move to closing reflection.
              </p>
            </div>
            <div className="lds-inline-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => onPhaseChange("COURSE_MAP")}
              >
                Back to course map
              </button>
              <button
                type="button"
                className="button"
                onClick={() => onPhaseChange("READINESS")}
              >
                Continue to readiness
              </button>
            </div>
          </div>

          <div className="lds-session-roadmap-inline">
            {weeklyPlans.map((week) => {
              const isSelected = week.id === selectedWeek.id;
              const weekCoaching = buildSessionCoaching(week);
              const label = buildSessionLabel(week, courseConfig);
              const isReady = weekCoaching.length === 0;

              return (
                <button
                  key={week.id}
                  type="button"
                  className={`lds-session-roadmap-item${isSelected ? " active" : ""}`}
                  onClick={() => onSelectWeek(week.id)}
                >
                  <span className="lds-session-roadmap-label">{label}</span>
                  <strong>{week.title || "Untitled session"}</strong>
                  <span className={`lds-session-roadmap-status${isReady ? " ready" : " notes"}`}>
                    {isReady
                      ? "✓ Ready"
                      : `${weekCoaching.length} note${weekCoaching.length === 1 ? "" : "s"}`}
                  </span>
                </button>
              );
            })}
          </div>

          {blockers.length > 0 ? (
            <div className="lds-blocker-card" role="alert">
              <strong>🚫 Current session-building blockers</strong>
              <ul className="lds-simple-list">
                {blockers.slice(0, 5).map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {coaching.length > 0 ? (
            <div className="lds-coaching-strip">
              {coaching.map((note) => (
                <span key={note}>{note}</span>
              ))}
            </div>
          ) : (
            <div className="lds-success-strip">
              ✓ This session has the core pieces in place. Now you can tighten the details.
            </div>
          )}

          <div className="lds-form-grid">
            <label className="lds-form-field">
              <span>Session title</span>
              <input
                value={selectedWeek.title}
                readOnly={isReadOnly}
                onChange={(event) =>
                  onUpdateWeek(selectedWeek.id, "title", event.target.value)
                }
                placeholder="Example: Budgeting Basics"
              />
            </label>
            <label className="lds-form-field">
              <span>Class time budget</span>
              <input
                type="number"
                min={15}
                value={selectedWeek.classDurationMin}
                readOnly={isReadOnly}
                onChange={(event) =>
                  onUpdateWeek(
                    selectedWeek.id,
                    "classDurationMin",
                    Math.max(15, Number(event.target.value) || 15)
                  )
                }
              />
            </label>
          </div>

          <div className="lds-session-balance">
            <div className="lds-session-balance-copy">
              <span className="lds-session-balance-label">Pacing balance</span>
              <strong>
                {totalMinutes} of {selectedWeek.classDurationMin} planned minutes
              </strong>
            </div>
            <div className="lds-session-balance-track" aria-hidden="true">
              <span
                className={`lds-session-balance-fill${
                  totalMinutes > selectedWeek.classDurationMin ? " over" : ""
                }`}
                style={
                  {
                    width: `${Math.min(
                      100,
                      Math.max(
                        6,
                        (totalMinutes / Math.max(selectedWeek.classDurationMin, 1)) * 100
                      )
                    )}%`,
                  } as CSSProperties
                }
              />
            </div>
          </div>

          <label className="lds-form-field">
            <span>Session objective</span>
            <textarea
              rows={3}
              value={selectedWeek.objective ?? ""}
              readOnly={isReadOnly}
              onChange={(event) =>
                onUpdateWeek(selectedWeek.id, "objective", event.target.value)
              }
              placeholder="What should students be able to do by the end of this session?"
            />
          </label>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Activity arc</h3>
                <p>Arrange the moments that make the session feel intentional from entry to closure.</p>
              </div>
            </div>

            <SessionTimeline
              activities={sortedActivities}
              classDurationMin={selectedWeek.classDurationMin}
              readOnly={isReadOnly}
              selectedActivityId={selectedActivityId}
              onSelectActivity={setSelectedActivityId}
              onReorderActivity={(activeId, overId) =>
                onReorderActivities(selectedWeek.id, activeId, overId)
              }
              onResizeActivity={(activityId, durationMin) =>
                onUpdateActivity(selectedWeek.id, activityId, { durationMin })
              }
            />

            <div className="lds-add-activity-area">
              <div className="lds-quick-add-row" aria-label="Quick add activity types">
                {QUICK_ADD_ACTIVITY_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className="lds-quick-add-chip"
                    disabled={isReadOnly}
                    onClick={() =>
                      onAddActivity(selectedWeek.id, buildActivitySeed(type))
                    }
                  >
                    <span className="lds-quick-add-icon" aria-hidden="true">
                      {type.icon}
                    </span>
                    <span className="lds-quick-add-copy">
                      <strong>{type.label}</strong>
                      <small>{type.defaultDuration} min default</small>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="lds-more-templates-toggle"
                  onClick={() => setShowTemplates((prev) => !prev)}
                >
                  {showTemplates ? "− Less" : "+ More templates"}
                </button>
              </div>

              {showTemplates ? (
                <div className="lds-template-suggestions">
                  {QUICK_TEMPLATES.map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      className="lds-template-suggestion"
                      disabled={isReadOnly}
                      onClick={() => onAddActivity(selectedWeek.id, buildActivitySeed(template))}
                    >
                      <strong>{template.title}</strong>
                      <span>{template.durationMin} min</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="lds-add-activity-secondary">
                <button
                  type="button"
                  className="button ghost small"
                  disabled={isReadOnly}
                  onClick={() => onOpenTemplates(selectedWeek.id)}
                >
                  Open template library
                </button>
                <button
                  type="button"
                  className="button ghost small"
                  disabled={isReadOnly}
                  onClick={() => onOpenExamplesLibrary(selectedWeek.id)}
                >
                  Import example
                </button>
              </div>
            </div>

            <div className="lds-activity-stack lds-session-mobile-stack">
              {sortedActivities.length === 0 ? (
                <div className="lds-empty-activities">
                  <span className="lds-empty-activities-icon" aria-hidden="true">📋</span>
                  <strong className="lds-empty-activities-heading">No activities yet</strong>
                  <p className="lds-empty-activities-copy">
                    Build the session arc by adding your first teaching move.
                  </p>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={isReadOnly}
                    onClick={() =>
                      onAddActivity(
                        selectedWeek.id,
                        buildActivitySeed(QUICK_ADD_ACTIVITY_TYPES[0])
                      )
                    }
                  >
                    Add your first activity
                  </button>
                </div>
              ) : (
                sortedActivities.map((activity, index) => {
                  const config = getActivityTypeConfig(activity.type);

                  return (
                    <article
                      key={activity.id}
                      className={`lds-activity-card${
                        selectedActivityId === activity.id ? " active" : ""
                      }`}
                      style={
                        {
                          "--lds-activity-accent": config.color,
                        } as CSSProperties
                      }
                    >
                      <button
                        type="button"
                        className="lds-activity-primary"
                        onClick={() => setSelectedActivityId(activity.id)}
                      >
                        <span className="lds-activity-order" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="lds-activity-handle" aria-hidden="true">
                          ⋮⋮
                        </span>
                        <div className="lds-activity-copy">
                          <div className="lds-activity-meta">
                            <span className="lds-activity-type">
                              {config.icon} {config.label}
                            </span>
                            <span className="lds-activity-duration-badge">
                              {activity.durationMin} min
                            </span>
                          </div>
                          <strong>{activity.title || "Untitled activity"}</strong>
                          <p className="lds-activity-description">
                            {getLessonDesignStudioRichPreview(activity.description, {
                              fallback:
                                "Add the exact prompt, student action, or teacher move this activity should create.",
                            })}
                          </p>
                        </div>
                      </button>
                      <div className="lds-activity-actions">
                        <button
                          type="button"
                          className="lds-icon-btn"
                          aria-label="Move up"
                          disabled={index === 0 || isReadOnly}
                          onClick={() => moveActivity(activity.id, "up")}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="lds-icon-btn"
                          aria-label="Move down"
                          disabled={index === sortedActivities.length - 1 || isReadOnly}
                          onClick={() => moveActivity(activity.id, "down")}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="lds-icon-btn"
                          aria-label="Edit activity"
                          onClick={() => setSelectedActivityId(activity.id)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="lds-icon-btn lds-icon-btn-danger"
                          aria-label="Remove activity"
                          disabled={isReadOnly}
                          onClick={() => onRemoveActivity(selectedWeek.id, activity.id)}
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>At-home assignment</h3>
                <p>Keep it manageable. The goal is reinforcement, not overload.</p>
              </div>
              {!selectedWeek.atHomeAssignment ? (
                <button
                  type="button"
                  className="button secondary"
                  disabled={isReadOnly}
                  onClick={() =>
                    onUpdateWeek(selectedWeek.id, "atHomeAssignment", {
                      type: "REFLECTION_PROMPT",
                      title: "",
                      description: "",
                    })
                  }
                >
                  Add at-home work
                </button>
              ) : (
                <button
                  type="button"
                  className="button ghost danger"
                  disabled={isReadOnly}
                  onClick={() => onUpdateWeek(selectedWeek.id, "atHomeAssignment", null)}
                >
                  Remove
                </button>
              )}
            </div>

            {selectedWeek.atHomeAssignment ? (
              <div className="lds-stack">
                <label className="lds-form-field">
                  <span>Assignment type</span>
                  <select
                    value={selectedWeek.atHomeAssignment.type}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      updateAtHomeAssignment({
                        type: event.target.value as AtHomeAssignment["type"],
                      })
                    }
                  >
                    {AT_HOME_TYPE_CONFIG.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lds-form-field">
                  <span>Assignment title</span>
                  <input
                    value={selectedWeek.atHomeAssignment.title}
                    readOnly={isReadOnly}
                    onChange={(event) =>
                      updateAtHomeAssignment({ title: event.target.value })
                    }
                    placeholder="Example: Track Your Spending"
                  />
                </label>
                <label className="lds-form-field">
                  <span>Assignment description</span>
                  <textarea
                    rows={3}
                    value={selectedWeek.atHomeAssignment.description}
                    readOnly={isReadOnly}
                    onChange={(event) =>
                      updateAtHomeAssignment({ description: event.target.value })
                    }
                    placeholder="What should students do after class?"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Materials checklist</h3>
                {materialsCount > 0 ? (
                  <p>{materialsCount} material{materialsCount === 1 ? "" : "s"} added</p>
                ) : (
                  <p>List what you need to prepare before teaching this session.</p>
                )}
              </div>
              <button
                type="button"
                className="button ghost small"
                onClick={() => setShowMaterialsChecklist((prev) => !prev)}
              >
                {showMaterialsChecklist ? "Collapse" : "Edit checklist"}
              </button>
            </div>

            {showMaterialsChecklist ? (
              <label className="lds-form-field">
                <span>Materials checklist</span>
                <textarea
                  rows={4}
                  value={selectedWeek.materialsChecklist.join("\n")}
                  readOnly={isReadOnly}
                  onChange={(event) => updateChecklist(event.target.value)}
                  placeholder="One material per line"
                />
              </label>
            ) : null}
          </section>

          <details className="lds-advanced-panel">
            <summary>Advanced planning details</summary>
            <div className="lds-stack">
              <label className="lds-form-field">
                <span>Teacher prep notes</span>
                <textarea
                  rows={4}
                  value={selectedWeek.teacherPrepNotes ?? ""}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    onUpdateWeek(selectedWeek.id, "teacherPrepNotes", event.target.value)
                  }
                  placeholder="What should the instructor prepare before teaching this session?"
                />
              </label>
              <div className="lds-inline-actions">
                <button
                  type="button"
                  className="button ghost"
                  disabled={isReadOnly}
                  onClick={() => onDuplicateWeek(selectedWeek.id)}
                >
                  Duplicate this session
                </button>
                <button
                  type="button"
                  className="button ghost danger"
                  disabled={isReadOnly}
                  onClick={() => onRemoveWeek(selectedWeek.id)}
                >
                  Clear this session
                </button>
              </div>
            </div>
          </details>
        </section>

        <StudioMicroChecks
          title="Session design checks"
          description="Answer these while you build so the final readiness score is mostly done before you reach the last step."
          questionIds={[
            "objective_alignment",
            "session_pacing",
            "activity_sequence",
            "homework_purpose",
            "example_usage",
            "differentiation_use",
          ]}
          understandingChecks={understandingChecks}
          onAnswer={onAnswerUnderstandingCheck}
          readOnly={isReadOnly}
        />
      </div>

      <div className="lds-step-side">
        <StudioExampleSpotlight
          mode="session"
          interestArea={interestArea}
          selectedWeekNumber={selectedWeek.weekNumber}
          selectedSessionLabel={buildSessionLabel(selectedWeek, courseConfig)}
          onImportWeek={(week) => {
            onImportExampleWeek(week, selectedWeek.id);
          }}
          onOpenLibrary={() => onOpenExamplesLibrary(selectedWeek.id)}
        />
      </div>

      <ActivityDetailDrawer
        activity={selectedActivity}
        currentUserId={currentUserId}
        canComment={canComment}
        canResolveComments={canResolveComments}
        readOnly={isReadOnly}
        getCommentStats={getCommentStats}
        onClose={() => setSelectedActivityId(null)}
        onUpdate={(activityId, fields) =>
          onUpdateActivity(selectedWeek.id, activityId, fields)
        }
        onOpenComments={onOpenComments}
        onCreateComment={onCreateComment}
        onResolveComment={onResolveComment}
        onDeleteComment={onDeleteComment}
      />
    </section>
  );
}
