"use client";

import {
  MIN_ACTIVITIES_PER_SESSION,
  MIN_CURRICULUM_OUTCOMES,
  UNDERSTANDING_PASS_SCORE_PCT,
  type CurriculumDraftProgress,
  type StudioUnderstandingChecks,
} from "@/lib/curriculum-draft-progress";
import type { StudioPhase } from "@/lib/lesson-design-studio";
import { StudioMicroChecks } from "./studio-micro-checks";

interface StudioReadinessStepProps {
  progress: CurriculumDraftProgress;
  blockers: string[];
  understandingChecks: StudioUnderstandingChecks;
  isReadOnly: boolean;
  onPhaseChange: (phase: StudioPhase) => void;
  onAnswerUnderstandingCheck: (questionId: string, answer: string) => void;
}

const CHECKLIST_ITEMS = [
  {
    key: "outcomes",
    label: `At least ${MIN_CURRICULUM_OUTCOMES} learning outcomes are in place`,
    getPass: (progress: CurriculumDraftProgress) =>
      progress.submissionIssues.every(
        (issue) => !issue.includes("learning outcomes")
      ),
  },
  {
    key: "titles",
    label: "Every session has a title",
    getPass: (progress: CurriculumDraftProgress) =>
      progress.sessionsWithTitles === progress.totalSessionsExpected,
  },
  {
    key: "objectives",
    label: "Every session has an objective",
    getPass: (progress: CurriculumDraftProgress) =>
      progress.sessionsWithObjectives === progress.totalSessionsExpected,
  },
  {
    key: "activities",
    label: `Every session has ${MIN_ACTIVITIES_PER_SESSION}+ activities`,
    getPass: (progress: CurriculumDraftProgress) =>
      progress.sessionsWithThreeActivities === progress.totalSessionsExpected,
  },
  {
    key: "homework",
    label: "Every session includes at-home work",
    getPass: (progress: CurriculumDraftProgress) =>
      progress.sessionsWithAtHomeAssignments === progress.totalSessionsExpected,
  },
  {
    key: "pacing",
    label: "Every session fits the time budget",
    getPass: (progress: CurriculumDraftProgress) =>
      progress.sessionsWithinTimeBudget === progress.totalSessionsExpected,
  },
  {
    key: "checks",
    label: `Teaching checks passed at ${UNDERSTANDING_PASS_SCORE_PCT}% or higher`,
    getPass: (progress: CurriculumDraftProgress) => progress.understandingChecksPassed,
  },
];

export function StudioReadinessStep({
  progress,
  blockers,
  understandingChecks,
  isReadOnly,
  onPhaseChange,
  onAnswerUnderstandingCheck,
}: StudioReadinessStepProps) {
  return (
    <section className="lds-step-layout">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-step-card-header">
            <div>
              <p className="lds-section-eyebrow">Step 3</p>
              <h2 className="lds-section-title">Tighten the last teaching moves</h2>
              <p className="lds-section-copy">
                This step makes sure the curriculum feels teachable, paced, and ready
                for a reviewer to believe in it.
              </p>
            </div>
            <div className="lds-inline-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => onPhaseChange("SESSIONS")}
              >
                Back to sessions
              </button>
              <button
                type="button"
                className="button"
                onClick={() => onPhaseChange("REVIEW_LAUNCH")}
              >
                Open review hub
              </button>
            </div>
          </div>

          <div className="lds-checklist-grid">
            {CHECKLIST_ITEMS.map((item) => {
              const pass = item.getPass(progress);

              return (
                <article
                  key={item.key}
                  className={`lds-checklist-item${pass ? " pass" : ""}`}
                >
                  <span>{pass ? "✓" : "•"}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{pass ? "This part is in place." : "This still needs attention."}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="lds-subsection-card">
            <div className="lds-subsection-header">
              <div>
                <h3>Remaining blockers</h3>
                <p>These are the exact things still standing between the draft and submission.</p>
              </div>
            </div>
            {blockers.length === 0 ? (
              <div className="lds-success-strip">
                All major blockers are cleared. You can move into the review and launch hub.
              </div>
            ) : (
              <ul className="lds-simple-list">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <StudioMicroChecks
          title="Final readiness checks"
          description="Finish the remaining teaching checks here so your readiness score reflects the thinking behind the curriculum."
          questionIds={["course_outcomes", "capstone_goal"]}
          understandingChecks={understandingChecks}
          onAnswer={onAnswerUnderstandingCheck}
          readOnly={isReadOnly}
        />
      </div>

      <aside className="lds-step-side">
        <section className="lds-step-card">
          <p className="lds-section-eyebrow">Progress snapshot</p>
          <h3 className="lds-section-title">How close you are</h3>
          <div className="lds-kpi-stack">
            <div>
              <span>Fully built sessions</span>
              <strong>
                {progress.fullyBuiltSessions}/{progress.totalSessionsExpected}
              </strong>
            </div>
            <div>
              <span>Teaching checks</span>
              <strong>
                {understandingChecks.lastScorePct ?? 0}% score
              </strong>
            </div>
            <div>
              <span>Submission status</span>
              <strong>{progress.readyForSubmission ? "Ready" : "Still tightening"}</strong>
            </div>
          </div>
        </section>
      </aside>
    </section>
  );
}
