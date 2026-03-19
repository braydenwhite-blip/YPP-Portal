"use client";

import type { StudioPhase } from "@/lib/lesson-design-studio";
import type { StudioUnderstandingChecks, StudioCourseConfig } from "../types";
import {
  DELIVERY_MODE_OPTIONS,
  DIFFICULTY_LEVEL_OPTIONS,
} from "./activity-template-data";
import { StudioExampleSpotlight } from "./studio-example-spotlight";
import { StudioMicroChecks } from "./studio-micro-checks";

interface StudioCourseMapStepProps {
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  courseConfig: StudioCourseConfig;
  blockers: string[];
  understandingChecks: StudioUnderstandingChecks;
  isReadOnly: boolean;
  onUpdate: (field: string, value: unknown) => void;
  onPhaseChange: (phase: StudioPhase) => void;
  onAnswerUnderstandingCheck: (questionId: string, answer: string) => void;
  onOpenExamplesLibrary: () => void;
}

export function StudioCourseMapStep({
  title,
  description,
  interestArea,
  outcomes,
  courseConfig,
  blockers,
  understandingChecks,
  isReadOnly,
  onUpdate,
  onPhaseChange,
  onAnswerUnderstandingCheck,
  onOpenExamplesLibrary,
}: StudioCourseMapStepProps) {
  const safeOutcomes = outcomes.length > 0 ? outcomes : [""];

  function updateOutcome(index: number, value: string) {
    const next = [...safeOutcomes];
    next[index] = value;
    onUpdate("outcomes", next);
  }

  function removeOutcome(index: number) {
    const next = safeOutcomes.filter((_, currentIndex) => currentIndex !== index);
    onUpdate("outcomes", next.length > 0 ? next : [""]);
  }

  function addOutcome() {
    onUpdate("outcomes", [...safeOutcomes, ""]);
  }

  function updateCourseConfig(patch: Partial<StudioCourseConfig>) {
    onUpdate("courseConfig", {
      ...courseConfig,
      ...patch,
    });
  }

  return (
    <section className="lds-step-layout">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-step-card-header">
            <div>
              <p className="lds-section-eyebrow">Step 1</p>
              <h2 className="lds-section-title">Shape the course promise</h2>
              <p className="lds-section-copy">
                This is the big picture. Give the course a name, a purpose, and outcomes
                that make the rest of the curriculum feel connected.
              </p>
            </div>
            <div className="lds-inline-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => onPhaseChange("START")}
              >
                Back to start
              </button>
              <button
                type="button"
                className="button"
                onClick={() => onPhaseChange("SESSIONS")}
              >
                Continue to sessions
              </button>
            </div>
          </div>

          {blockers.length > 0 ? (
            <div className="lds-blocker-card" role="alert">
              <strong>Still blocking this step</strong>
              <ul className="lds-simple-list">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="lds-form-grid">
            <label className="lds-form-field">
              <span>Curriculum title</span>
              <input
                value={title}
                readOnly={isReadOnly}
                onChange={(event) => onUpdate("title", event.target.value)}
                placeholder="Example: Money Moves for Real Life"
              />
            </label>

            <label className="lds-form-field">
              <span>Interest area</span>
              <input
                value={interestArea}
                readOnly={isReadOnly}
                onChange={(event) => onUpdate("interestArea", event.target.value)}
                placeholder="Example: Finance, Coding, Music, Cooking"
              />
            </label>
          </div>

          <label className="lds-form-field">
            <span>Why this course matters</span>
            <textarea
              rows={4}
              value={description}
              readOnly={isReadOnly}
              onChange={(event) => onUpdate("description", event.target.value)}
              placeholder="What will students learn, and why is this worth teaching?"
            />
          </label>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Learning outcomes</h3>
                <p>
                  Name the abilities students should leave with by the end of the course.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={isReadOnly}
                onClick={addOutcome}
              >
                Add outcome
              </button>
            </div>

            <div className="lds-stack">
              {safeOutcomes.map((outcome, index) => (
                <div key={`outcome-${index}`} className="lds-inline-edit-row">
                  <input
                    value={outcome}
                    readOnly={isReadOnly}
                    onChange={(event) => updateOutcome(index, event.target.value)}
                    placeholder={`Outcome ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="button ghost"
                    disabled={isReadOnly || safeOutcomes.length === 1}
                    onClick={() => removeOutcome(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Teaching container</h3>
                <p>Decide the basic shape of the learning experience before polishing lessons.</p>
              </div>
            </div>

            <div className="lds-form-grid three">
              <label className="lds-form-field">
                <span>Weeks</span>
                <input
                  type="number"
                  min={1}
                  value={courseConfig.durationWeeks}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      durationWeeks: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
              <label className="lds-form-field">
                <span>Sessions each week</span>
                <input
                  type="number"
                  min={1}
                  value={courseConfig.sessionsPerWeek}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      sessionsPerWeek: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
              <label className="lds-form-field">
                <span>Minutes per session</span>
                <input
                  type="number"
                  min={15}
                  value={courseConfig.classDurationMin}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      classDurationMin: Math.max(15, Number(event.target.value) || 15),
                    })
                  }
                />
              </label>
            </div>

            <div className="lds-form-grid two">
              <label className="lds-form-field">
                <span>Target age group</span>
                <input
                  value={courseConfig.targetAgeGroup}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({ targetAgeGroup: event.target.value })
                  }
                  placeholder="Example: Middle school, ages 14-17"
                />
              </label>
              <label className="lds-form-field">
                <span>Difficulty level</span>
                <select
                  value={courseConfig.difficultyLevel}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      difficultyLevel: event.target.value as StudioCourseConfig["difficultyLevel"],
                    })
                  }
                >
                  {DIFFICULTY_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="lds-form-grid three">
              <label className="lds-form-field">
                <span>Minimum students</span>
                <input
                  type="number"
                  min={1}
                  value={courseConfig.minStudents}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      minStudents: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
              <label className="lds-form-field">
                <span>Ideal size</span>
                <input
                  type="number"
                  min={1}
                  value={courseConfig.idealSize}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      idealSize: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
              <label className="lds-form-field">
                <span>Maximum students</span>
                <input
                  type="number"
                  min={1}
                  value={courseConfig.maxStudents}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      maxStudents: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
            </div>

            <div className="lds-form-grid two">
              <label className="lds-form-field">
                <span>Estimated teaching hours</span>
                <input
                  type="number"
                  min={1}
                  value={courseConfig.estimatedHours}
                  readOnly={isReadOnly}
                  onChange={(event) =>
                    updateCourseConfig({
                      estimatedHours: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>
              <div className="lds-form-field">
                <span>Delivery modes</span>
                <div className="lds-chip-row">
                  {DELIVERY_MODE_OPTIONS.map((option) => {
                    const selected = courseConfig.deliveryModes.includes(option.value);

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`lds-chip${selected ? " selected" : ""}`}
                        disabled={isReadOnly}
                        onClick={() => {
                          const nextModes = selected
                            ? courseConfig.deliveryModes.filter((mode) => mode !== option.value)
                            : [...courseConfig.deliveryModes, option.value];

                          onUpdate("courseConfig", {
                            ...courseConfig,
                            deliveryModes: nextModes.length > 0 ? nextModes : [option.value],
                          });
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </section>

        <StudioMicroChecks
          title="Course promise checks"
          description="These quick checks make sure the big picture of the curriculum stays coherent while you build."
          questionIds={["course_outcomes", "capstone_goal"]}
          understandingChecks={understandingChecks}
          onAnswer={onAnswerUnderstandingCheck}
          readOnly={isReadOnly}
        />
      </div>

      <div className="lds-step-side">
        <StudioExampleSpotlight
          mode="course-map"
          interestArea={interestArea}
          onOpenLibrary={onOpenExamplesLibrary}
        />
      </div>
    </section>
  );
}
