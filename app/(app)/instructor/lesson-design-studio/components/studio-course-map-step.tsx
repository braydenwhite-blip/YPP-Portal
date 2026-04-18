"use client";

import { useId } from "react";
import type { StudioPhase } from "@/lib/lesson-design-studio";
import type {
  CurriculumCommentAnchor,
  CurriculumCommentRecord,
  StudioUnderstandingChecks,
  StudioCourseConfig,
} from "../types";
import {
  DELIVERY_MODE_OPTIONS,
  DIFFICULTY_LEVEL_OPTIONS,
} from "./activity-template-data";
import { CommentIndicator } from "./comment-indicator";
import { CommentThread } from "./comment-thread";
import { StudioExampleSpotlight } from "./studio-example-spotlight";
import { StudioMicroChecks } from "./studio-micro-checks";

interface StudioCourseMapStepProps {
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  courseConfig: StudioCourseConfig;
  currentUserId: string;
  canComment: boolean;
  canResolveComments: boolean;
  blockers: string[];
  understandingChecks: StudioUnderstandingChecks;
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
  onUpdate: (field: string, value: unknown) => void;
  onPhaseChange: (phase: StudioPhase) => void;
  onAnswerUnderstandingCheck: (questionId: string, answer: string) => void;
  onOpenExamplesLibrary: () => void;
  onOpenComments: (anchor: CurriculumCommentAnchor) => void;
  onCreateComment: (
    anchor: CurriculumCommentAnchor,
    body: string,
    parentId?: string | null
  ) => Promise<void> | void;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
}

export function StudioCourseMapStep({
  title,
  description,
  interestArea,
  outcomes,
  courseConfig,
  currentUserId,
  canComment,
  canResolveComments,
  blockers,
  understandingChecks,
  isReadOnly,
  getCommentStats,
  onUpdate,
  onPhaseChange,
  onAnswerUnderstandingCheck,
  onOpenExamplesLibrary,
  onOpenComments,
  onCreateComment,
  onResolveComment,
  onDeleteComment,
}: StudioCourseMapStepProps) {
  const titleId = useId();
  const titleHintId = useId();
  const interestAreaId = useId();
  const interestAreaHintId = useId();
  const descriptionId = useId();
  const descriptionHintId = useId();
  const safeOutcomes = outcomes.length > 0 ? outcomes : [""];
  const titleAnchor: CurriculumCommentAnchor = {
    anchorType: "COURSE",
    anchorField: "title",
    label: "Course title",
  };
  const interestAreaAnchor: CurriculumCommentAnchor = {
    anchorType: "COURSE",
    anchorField: "interestArea",
    label: "Interest area",
  };
  const descriptionAnchor: CurriculumCommentAnchor = {
    anchorType: "COURSE",
    anchorField: "description",
    label: "Course description",
  };
  const titleCommentStats = getCommentStats(titleAnchor);
  const interestAreaCommentStats = getCommentStats(interestAreaAnchor);
  const descriptionCommentStats = getCommentStats(descriptionAnchor);

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

  function renderCommentThread(
    anchor: CurriculumCommentAnchor,
    title: string,
    comments: CurriculumCommentRecord[]
  ) {
    if (comments.length === 0) {
      return null;
    }

    return (
      <CommentThread
        title={title}
        comments={comments}
        currentUserId={currentUserId}
        canComment={canComment}
        canResolveComments={canResolveComments}
        onCreateComment={(body, parentId) => onCreateComment(anchor, body, parentId)}
        onResolveComment={onResolveComment}
        onDeleteComment={onDeleteComment}
      />
    );
  }

  return (
    <section className="lds-step-layout lds-step-layout--course-map">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-step-card-header">
            <div>
              <p className="lds-section-eyebrow">Course</p>
              <h2 className="lds-section-title">Promise & shape</h2>
              <p className="lds-section-copy">Title, audience, outcomes, and schedule shell.</p>
            </div>
            <div className="lds-inline-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => onPhaseChange("START")}
              >
                Start
              </button>
              <button
                type="button"
                className="button"
                onClick={() => onPhaseChange("SESSIONS")}
              >
                Sessions
              </button>
            </div>
          </div>

          {blockers.length > 0 ? (
            <div className="lds-blocker-card" role="alert">
              <strong>Blocked</strong>
              <ul className="lds-simple-list">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="lds-course-map-summary">
            <div className="lds-stat-card">
              <span className="lds-stat-label">Weeks</span>
              <strong className="lds-stat-value">
                {courseConfig.durationWeeks}
              </strong>
            </div>
            <div className="lds-stat-card">
              <span className="lds-stat-label">Sessions/wk</span>
              <strong className="lds-stat-value">
                {courseConfig.sessionsPerWeek}
              </strong>
            </div>
            <div className="lds-stat-card">
              <span className="lds-stat-label">Minutes</span>
              <strong className="lds-stat-value">
                {courseConfig.classDurationMin}
              </strong>
            </div>
          </div>

          <div className="lds-form-grid">
            <div className="lds-form-field">
              <div className="lds-form-label-row">
                <label className="lds-form-label" htmlFor={titleId}>
                  Curriculum title
                </label>
                {canComment || titleCommentStats.count > 0 ? (
                  <CommentIndicator
                    count={titleCommentStats.count}
                    unresolvedCount={titleCommentStats.unresolvedCount}
                    label="Course title comments"
                    onClick={() => onOpenComments(titleAnchor)}
                  />
                ) : null}
              </div>
              <input
                id={titleId}
                aria-describedby={titleHintId}
                value={title}
                readOnly={isReadOnly}
                onChange={(event) => onUpdate("title", event.target.value)}
                placeholder="Example: Money Moves for Real Life"
              />
              <small id={titleHintId} className="lds-form-field-hint">
                Specific title students would recognize.
              </small>
              {renderCommentThread(
                titleAnchor,
                "Course title feedback",
                titleCommentStats.comments
              )}
            </div>

            <div className="lds-form-field">
              <div className="lds-form-label-row">
                <label className="lds-form-label" htmlFor={interestAreaId}>
                  Interest area
                </label>
                {canComment || interestAreaCommentStats.count > 0 ? (
                  <CommentIndicator
                    count={interestAreaCommentStats.count}
                    unresolvedCount={interestAreaCommentStats.unresolvedCount}
                    label="Interest area comments"
                    onClick={() => onOpenComments(interestAreaAnchor)}
                  />
                ) : null}
              </div>
              <input
                id={interestAreaId}
                aria-describedby={interestAreaHintId}
                value={interestArea}
                readOnly={isReadOnly}
                onChange={(event) => onUpdate("interestArea", event.target.value)}
                placeholder="Example: Finance, Coding, Music, Cooking"
              />
              <small id={interestAreaHintId} className="lds-form-field-hint">
                Drives example picks and coaching tone.
              </small>
              {renderCommentThread(
                interestAreaAnchor,
                "Interest area feedback",
                interestAreaCommentStats.comments
              )}
            </div>
          </div>

          <div className="lds-form-field">
            <div className="lds-form-label-row">
              <label className="lds-form-label" htmlFor={descriptionId}>
                Course description
              </label>
              {canComment || descriptionCommentStats.count > 0 ? (
                <CommentIndicator
                  count={descriptionCommentStats.count}
                  unresolvedCount={descriptionCommentStats.unresolvedCount}
                  label="Course description comments"
                  onClick={() => onOpenComments(descriptionAnchor)}
                />
              ) : null}
            </div>
            <textarea
              id={descriptionId}
              aria-describedby={descriptionHintId}
              rows={3}
              value={description}
              readOnly={isReadOnly}
              onChange={(event) => onUpdate("description", event.target.value)}
              placeholder="What will students learn, and why is this worth teaching?"
            />
            <small id={descriptionHintId} className="lds-form-field-hint">
              What students gain and why it matters.
            </small>
            {renderCommentThread(
              descriptionAnchor,
              "Course description feedback",
              descriptionCommentStats.comments
            )}
          </div>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Outcomes</h3>
                <p>What students can do by the end.</p>
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={isReadOnly}
                onClick={addOutcome}
              >
                Add
              </button>
            </div>

            <div className="lds-stack">
              {safeOutcomes.map((outcome, index) => (
                (() => {
                  const outcomeAnchor: CurriculumCommentAnchor = {
                    anchorType: "OUTCOME",
                    anchorId: String(index),
                    anchorField: "value",
                    label: `Outcome ${index + 1}`,
                    detail: outcome || null,
                  };
                  const outcomeCommentStats = getCommentStats(outcomeAnchor);

                  return (
                    <div
                      key={`outcome-${index}-${outcome.substring(0, 20)}`}
                      className="lds-outcome-thread-group"
                    >
                      <div className="lds-inline-edit-row lds-outcome-row">
                        <span className="lds-outcome-index" aria-hidden="true">
                          {index + 1}
                        </span>
                        <input
                          value={outcome}
                          readOnly={isReadOnly}
                          onChange={(event) => updateOutcome(index, event.target.value)}
                          placeholder={`Outcome ${index + 1}`}
                        />
                        {canComment || outcomeCommentStats.count > 0 ? (
                          <CommentIndicator
                            count={outcomeCommentStats.count}
                            unresolvedCount={outcomeCommentStats.unresolvedCount}
                            label={`Outcome ${index + 1} comments`}
                            onClick={() => onOpenComments(outcomeAnchor)}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="button ghost"
                          disabled={isReadOnly || safeOutcomes.length === 1}
                          onClick={() => removeOutcome(index)}
                        >
                          Remove
                        </button>
                      </div>
                      {renderCommentThread(
                        outcomeAnchor,
                        `Outcome ${index + 1} feedback`,
                        outcomeCommentStats.comments
                      )}
                    </div>
                  );
                })()
              ))}
            </div>
          </section>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Schedule shell</h3>
                <p>Weeks, class size, delivery — tune sessions later.</p>
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

            <p className="lds-container-note">
              Realistic numbers here make session planning easier later.
            </p>
          </section>
        </section>

        <StudioMicroChecks
          eyebrow="Checks"
          title="Course promise"
          description="Two quick questions so the outline stays coherent."
          questionIds={["course_outcomes", "capstone_goal"]}
          understandingChecks={understandingChecks}
          onAnswer={onAnswerUnderstandingCheck}
          readOnly={isReadOnly}
        />

        <StudioExampleSpotlight
          mode="course-map"
          interestArea={interestArea}
          onOpenLibrary={onOpenExamplesLibrary}
          defaultExpanded={false}
        />
      </div>
    </section>
  );
}
