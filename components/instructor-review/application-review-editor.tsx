"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  INITIAL_REVIEW_RATING_OPTIONS,
  INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS,
  INSTRUCTOR_INITIAL_REVIEW_SIGNALS,
  type InstructorApplicationNextStepValue,
  type InstructorReviewCategoryValue,
  type ProgressRatingValue,
} from "@/lib/instructor-review-config";

type SignalState = {
  category: InstructorReviewCategoryValue;
  rating: ProgressRatingValue | null;
  notes: string;
};

type ReviewSnapshot = {
  status: "DRAFT" | "SUBMITTED";
  overallRating: ProgressRatingValue | null;
  nextStep: InstructorApplicationNextStepValue | null;
  summary: string | null;
  notes: string | null;
  concerns: string | null;
  applicantMessage: string | null;
  flagForLeadership: boolean;
  draftOverrideUsed: boolean;
  draftOverrideReason: string | null;
  curriculumDraftId: string | null;
  categories: Array<{
    category: InstructorReviewCategoryValue;
    rating: ProgressRatingValue | null;
    notes: string | null;
  }>;
} | null;

type RoughPlan = {
  courseIdea: string | null;
  courseOutline: string | null;
  firstClassPlan: string | null;
};

interface ApplicationReviewEditorProps {
  action: (formData: FormData) => void;
  applicationId: string;
  returnTo: string;
  initialReview: ReviewSnapshot;
  roughPlan: RoughPlan;
  canEdit: boolean;
  isLeadReviewer: boolean;
  hasLeadInterviewer: boolean;
}

function buildInitialSignals(initialReview: ReviewSnapshot): SignalState[] {
  return INSTRUCTOR_INITIAL_REVIEW_SIGNALS.map((signal) => {
    const existing = initialReview?.categories.find(
      (entry) => entry.category === signal.key
    );
    return {
      category: signal.key,
      rating: existing?.rating ?? null,
      notes: existing?.notes ?? "",
    };
  });
}

function FieldBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="slideout-field">
      <div className="slideout-field-label">{label}</div>
      <div className="slideout-field-value" style={{ whiteSpace: "pre-wrap" }}>
        {value?.trim() || "Not provided"}
      </div>
    </div>
  );
}

export default function ApplicationReviewEditor({
  action,
  applicationId,
  returnTo,
  initialReview,
  roughPlan,
  canEdit,
  isLeadReviewer,
  hasLeadInterviewer,
}: ApplicationReviewEditorProps) {
  const [nextStep, setNextStep] = useState<InstructorApplicationNextStepValue | "">(
    initialReview?.nextStep ?? ""
  );
  const [summary, setSummary] = useState(initialReview?.summary ?? "");
  const [applicantMessage, setApplicantMessage] = useState(
    initialReview?.applicantMessage ?? ""
  );
  const [flagForLeadership, setFlagForLeadership] = useState(
    initialReview?.flagForLeadership ?? false
  );
  const [signals, setSignals] = useState<SignalState[]>(
    buildInitialSignals(initialReview)
  );

  const showApplicantMessage =
    isLeadReviewer && (nextStep === "REQUEST_INFO" || nextStep === "REJECT");
  const moveToInterviewNeedsLead =
    isLeadReviewer && nextStep === "MOVE_TO_INTERVIEW" && !hasLeadInterviewer;
  const hasRedSignal = signals.some((signal) => signal.rating === "BEHIND_SCHEDULE");

  const signalPayload = useMemo(
    () =>
      JSON.stringify(
        signals.map((signal) => ({
          category: signal.category,
          rating: signal.rating,
          notes: signal.notes,
        }))
      ),
    [signals]
  );

  function updateSignalRating(
    categoryKey: InstructorReviewCategoryValue,
    rating: ProgressRatingValue
  ) {
    setSignals((current) =>
      current.map((signal) =>
        signal.category === categoryKey ? { ...signal, rating } : signal
      )
    );
  }

  return (
    <form action={action} className="form-grid application-review-editor">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="categoriesJson" value={signalPayload} />
      <input type="hidden" name="overallRating" value="" />
      <input type="hidden" name="notes" value="" />
      <input type="hidden" name="concerns" value="" />
      <input type="hidden" name="curriculumDraftId" value="" />
      <input type="hidden" name="draftOverrideUsed" value="false" />
      <input type="hidden" name="draftOverrideReason" value="" />

      {!canEdit ? (
        <div className="review-editor-notice">
          <p>
            This screen is locked because it has already been submitted. An admin can still edit it if needed.
          </p>
        </div>
      ) : null}

      <div className="review-editor-panel">
        <div>
          <h2>Rough Course Snapshot</h2>
          <p>
            Use this as a paper screen. The applicant will build the full curriculum later if hired.
          </p>
        </div>
        <div className="cockpit-detail-grid">
          <FieldBlock label="Class Idea" value={roughPlan.courseIdea} />
          <FieldBlock label="Rough Outline" value={roughPlan.courseOutline} />
          <FieldBlock label="First-Session Sketch" value={roughPlan.firstClassPlan} />
        </div>
      </div>

      <div className="review-editor-panel">
        <div>
          <h2>Initial Review Signals</h2>
          <p>
            Rate only the first-pass signals needed to decide whether an interview is worthwhile.
          </p>
        </div>

        {INSTRUCTOR_INITIAL_REVIEW_SIGNALS.map((signal) => {
          const current = signals.find((entry) => entry.category === signal.key)!;
          return (
            <div key={signal.key} className="review-category-card">
              <div>
                <div className="review-category-title">{signal.label}</div>
                <div className="review-category-description">
                  {signal.description}
                </div>
              </div>

              <div className="review-rating-grid review-rating-grid-compact">
                {INITIAL_REVIEW_RATING_OPTIONS.map((option) => {
                  const selected = current.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateSignalRating(signal.key, option.value)}
                      className={`review-rating-option${selected ? " is-selected" : ""}`}
                      style={
                        {
                          "--rating-color": option.color,
                          "--rating-bg": option.bg,
                        } as CSSProperties
                      }
                    >
                      <div>{option.shortLabel}</div>
                      <span>{option.helperLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {hasRedSignal ? (
          <div className="review-editor-warning">
            One or more signals are red. You can still move forward, but use the summary to explain why an interview is still appropriate.
          </div>
        ) : null}
      </div>

      <div className="review-editor-panel">
        <label className="form-row">
          Internal Summary
          <textarea
            className="input"
            name="summary"
            rows={4}
            value={summary}
            required={canEdit}
            disabled={!canEdit}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Summarize the strongest signal, any concern, and why this applicant should or should not continue."
          />
        </label>

        {isLeadReviewer ? (
          <label className="form-row">
            Next Step
            <select
              className="input"
              name="nextStep"
              value={nextStep}
              required={canEdit}
              onChange={(event) =>
                setNextStep(event.target.value as InstructorApplicationNextStepValue | "")
              }
              disabled={!canEdit}
            >
              <option value="">Choose the next step</option>
              {INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="review-editor-callout">
            Your review will inform the lead reviewer&apos;s official next-step decision.
            <input type="hidden" name="nextStep" value="" />
          </div>
        )}

        {moveToInterviewNeedsLead ? (
          <div className="review-editor-warning">
            Assign a lead interviewer before submitting Move to Interview. The lead will send 3 or more proposed times to the applicant.
          </div>
        ) : null}

        {showApplicantMessage ? (
          <label className="form-row">
            Applicant-Facing Message
            <textarea
              className="input"
              name="applicantMessage"
              rows={3}
              value={applicantMessage}
              required={canEdit}
              disabled={!canEdit}
              onChange={(event) => setApplicantMessage(event.target.value)}
              placeholder="This message will be used when asking for more information or rejecting the application."
            />
          </label>
        ) : (
          <input type="hidden" name="applicantMessage" value={applicantMessage} />
        )}

        <label className="review-checkbox-row">
          <input
            type="checkbox"
            checked={flagForLeadership}
            disabled={!canEdit}
            onChange={(event) => setFlagForLeadership(event.target.checked)}
          />
          Flag for leadership discussion
        </label>
        <input type="hidden" name="flagForLeadership" value={flagForLeadership ? "true" : "false"} />
      </div>

      <div className="review-editor-actions">
        <button
          className="button secondary"
          type="submit"
          name="intent"
          value="save"
          disabled={!canEdit}
          formNoValidate
        >
          Save Draft
        </button>
        <button
          className="button"
          type="submit"
          name="intent"
          value="submit"
          disabled={!canEdit || moveToInterviewNeedsLead}
        >
          Submit Initial Review
        </button>
      </div>
    </form>
  );
}
