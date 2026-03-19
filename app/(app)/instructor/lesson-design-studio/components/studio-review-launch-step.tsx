"use client";

import Link from "next/link";
import type {
  CurriculumDraftProgress,
  StudioReviewRubric,
} from "@/lib/curriculum-draft-progress";
import type { StudioPhase } from "@/lib/lesson-design-studio";
import { StudioExampleSpotlight } from "./studio-example-spotlight";

interface StudioReviewLaunchStepProps {
  reviewStatus: string;
  reviewRubric: StudioReviewRubric;
  reviewNotes: string;
  blockers: string[];
  progress: CurriculumDraftProgress;
  generatedTemplateId: string | null;
  isReadOnly: boolean;
  isApproved: boolean;
  needsRevision: boolean;
  isActionPending: boolean;
  interestArea: string;
  onPhaseChange: (phase: StudioPhase) => void;
  onExportPdf: (type: "student" | "instructor") => Promise<boolean>;
  onSubmit: () => Promise<boolean>;
  onCreateWorkingCopy: () => Promise<void>;
  onOpenExamplesLibrary: () => void;
}

function getReviewHeading(reviewStatus: string, needsRevision: boolean, isApproved: boolean) {
  if (isApproved) {
    return {
      title: "This curriculum is approved and ready for the next handoff",
      body:
        "You can export the package, review the final shape, and move into launch planning from here.",
    };
  }

  if (needsRevision) {
    return {
      title: "A reviewer asked you to tighten specific parts of the curriculum",
      body:
        "Use the guided fix path below so you can revise the right parts instead of guessing.",
    };
  }

  if (reviewStatus === "SUBMITTED") {
    return {
      title: "Your curriculum is with a reviewer now",
      body:
        "The package is preserved as review history. You can still export it and study the structure while you wait.",
    };
  }

  return {
    title: "This is your launch hub",
    body:
      "Use this space to see what is still blocking submission, export the package, and send it to review when it feels solid.",
  };
}

export function StudioReviewLaunchStep({
  reviewStatus,
  reviewRubric,
  reviewNotes,
  blockers,
  progress,
  generatedTemplateId,
  isReadOnly,
  isApproved,
  needsRevision,
  isActionPending,
  interestArea,
  onPhaseChange,
  onExportPdf,
  onSubmit,
  onCreateWorkingCopy,
  onOpenExamplesLibrary,
}: StudioReviewLaunchStepProps) {
  const heading = getReviewHeading(reviewStatus, needsRevision, isApproved);
  const reviewerNotes = [
    reviewRubric.summary,
    reviewRubric.sectionNotes.overview,
    reviewRubric.sectionNotes.courseStructure,
    reviewRubric.sectionNotes.sessionPlans,
    reviewRubric.sectionNotes.studentAssignments,
    reviewNotes,
  ].filter((note): note is string => Boolean(note && note.trim()));

  return (
    <section className="lds-step-layout">
      <div className="lds-step-main">
        <section className="lds-step-card">
          <div className="lds-step-card-header">
            <div>
              <p className="lds-section-eyebrow">Step 4</p>
              <h2 className="lds-section-title">{heading.title}</h2>
              <p className="lds-section-copy">{heading.body}</p>
            </div>
            <div className="lds-inline-actions">
              {!isApproved ? (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => onPhaseChange("READINESS")}
                >
                  Back to readiness
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  type="button"
                  className="button"
                  disabled={!progress.readyForSubmission || isActionPending}
                  onClick={() => void onSubmit()}
                >
                  Submit curriculum for review
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  disabled={isActionPending}
                  onClick={() => void onCreateWorkingCopy()}
                >
                  Use as starting point
                </button>
              )}
            </div>
          </div>

          <div className="lds-launch-grid">
            <article className="lds-subsection-card">
              <h3>Submission status</h3>
              <p className="lds-review-status-chip">{reviewStatus.replace(/_/g, " ")}</p>
              <p>
                {progress.readyForSubmission
                  ? "The draft has cleared the technical readiness rules."
                  : "There are still readiness rules to clear before submission."}
              </p>
            </article>

            <article className="lds-subsection-card">
              <h3>Export package</h3>
              <p>Open the student-facing or instructor-facing PDF before review or launch.</p>
              <div className="lds-inline-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={isActionPending}
                  onClick={() => void onExportPdf("student")}
                >
                  Export student view
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={isActionPending}
                  onClick={() => void onExportPdf("instructor")}
                >
                  Export instructor guide
                </button>
              </div>
            </article>
          </div>

          {blockers.length > 0 ? (
            <section className="lds-subsection-card">
              <h3>{needsRevision ? "Guided fix path" : "What still blocks submission"}</h3>
              <ul className="lds-simple-list">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
              {!isReadOnly ? (
                <div className="lds-inline-actions">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => onPhaseChange("COURSE_MAP")}
                  >
                    Revisit course map
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => onPhaseChange("SESSIONS")}
                  >
                    Revisit sessions
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {reviewerNotes.length > 0 ? (
            <section className="lds-subsection-card">
              <h3>Reviewer notes</h3>
              <ul className="lds-simple-list">
                {reviewerNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {isApproved && generatedTemplateId ? (
            <section className="lds-subsection-card accent">
              <h3>Next real-world step</h3>
              <p>
                Move from the approved curriculum into class settings and teaching launch.
              </p>
              <div className="lds-inline-actions">
                <Link
                  href={`/instructor/class-settings?template=${generatedTemplateId}`}
                  className="button"
                >
                  Continue to launch setup
                </Link>
              </div>
            </section>
          ) : null}
        </section>
      </div>

      <div className="lds-step-side">
        <StudioExampleSpotlight
          mode="launch"
          interestArea={interestArea}
          onOpenLibrary={onOpenExamplesLibrary}
        />
      </div>
    </section>
  );
}
