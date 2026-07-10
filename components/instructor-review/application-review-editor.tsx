"use client";

import { useMemo, useState, type CSSProperties } from "react";

import { buttonVariants } from "@/components/ui-v2";

import {
  CATEGORY_CARD,
  CATEGORY_DESCRIPTION,
  CATEGORY_TITLE,
  CHECKBOX_ROW,
  EDITOR_ACTIONS,
  EDITOR_CALLOUT,
  EDITOR_NOTICE,
  EDITOR_PANEL,
  EDITOR_WARNING,
  FIELD_INPUT,
  FIELD_LABEL,
  RATING_GRID,
  ratingOptionClass,
} from "./editor-classes";
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
  roughPlan?: RoughPlan;
  canEdit: boolean;
  lockedReason?: string | null;
  isLeadReviewer: boolean;
  hasLeadInterviewer: boolean;
  /** Application 360 inline — rubric + decision only, no course snapshot. */
  variant?: "full" | "compact";
}

function compactSignalLabel(label: string): string {
  return label.replace(/^GOAL \d+ — /, "");
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
    <div>
      <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 whitespace-pre-wrap text-[13.5px] text-ink">
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
  lockedReason,
  isLeadReviewer,
  hasLeadInterviewer,
  variant = "full",
}: ApplicationReviewEditorProps) {
  const compact = variant === "compact";
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
    <form action={action} className={compact ? "flex flex-col gap-3" : "flex flex-col gap-4"}>
      {compact ? (
        <h3 className="m-0 text-[14px] font-bold text-ink">Initial review</h3>
      ) : null}
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
        <div className={EDITOR_NOTICE}>
          <p>
            {lockedReason
              ? lockedReason
              : compact
                ? "Already submitted."
                : "This screen is locked because it has already been submitted. An admin can still edit it if needed."}
          </p>
        </div>
      ) : null}

      {!compact && roughPlan ? (
        <div className={EDITOR_PANEL}>
          <div>
            <h2>Rough Course Snapshot</h2>
            <p>
              Use this as a paper screen. The applicant will build the full curriculum later if hired.
            </p>
          </div>
          <div className="grid gap-3">
            <FieldBlock label="Class Idea" value={roughPlan.courseIdea} />
            <FieldBlock label="Rough Outline" value={roughPlan.courseOutline} />
            <FieldBlock label="First-Session Sketch" value={roughPlan.firstClassPlan} />
          </div>
        </div>
      ) : null}

      <div
        className={
          compact
            ? "flex flex-col gap-3 rounded-[10px] border border-line-soft bg-surface-soft/60 p-3"
            : EDITOR_PANEL
        }
      >
        {!compact ? (
          <div>
            <h2>Initial Review Signals</h2>
            <p>
              Rate only the first-pass signals needed to decide whether an interview is worthwhile.
            </p>
          </div>
        ) : (
          <p className="m-0 text-[12.5px] text-ink-muted">
            Rate each area. Red = not ready, Green = strong signal.
          </p>
        )}

        {INSTRUCTOR_INITIAL_REVIEW_SIGNALS.map((signal) => {
          const current = signals.find((entry) => entry.category === signal.key)!;
          return (
            <div key={signal.key} className={compact ? "flex flex-col gap-2" : CATEGORY_CARD}>
              <div>
                <div className={CATEGORY_TITLE}>
                  {compact ? compactSignalLabel(signal.label) : signal.label}
                </div>
                {!compact ? (
                  <div className={CATEGORY_DESCRIPTION}>{signal.description}</div>
                ) : null}
              </div>

              <div className={compact ? "grid grid-cols-3 gap-1.5" : RATING_GRID}>
                {INITIAL_REVIEW_RATING_OPTIONS.map((option) => {
                  const selected = current.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateSignalRating(signal.key, option.value)}
                      className={ratingOptionClass(selected)}
                      style={
                        (selected
                          ? { color: option.color, background: option.bg }
                          : { color: option.color }) as CSSProperties
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
          <div className={compact ? EDITOR_WARNING.replace("px-3.5 py-2.5", "px-3 py-2") : EDITOR_WARNING}>
            {compact
              ? "One or more areas are red — explain in your summary if you still recommend moving forward."
              : "One or more signals are red. You can still move forward, but use the summary to explain why an interview is still appropriate."}
          </div>
        ) : null}
      </div>

      <div
        className={
          compact
            ? "flex flex-col gap-3 rounded-[10px] border border-line-soft bg-surface-soft/60 p-3"
            : EDITOR_PANEL
        }
      >
        <label className={FIELD_LABEL}>
          {compact ? "Summary" : "Internal Summary"}
          <textarea
            className={FIELD_INPUT}
            name="summary"
            rows={compact ? 3 : 4}
            value={summary}
            required={canEdit}
            disabled={!canEdit}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={
              compact
                ? "Key strengths, concerns, and your recommendation."
                : "Summarize the strongest signal, any concern, and why this applicant should or should not continue."
            }
          />
        </label>

        {isLeadReviewer ? (
          <label className={FIELD_LABEL}>
            Next step
            <select
              className={FIELD_INPUT}
              name="nextStep"
              value={nextStep}
              required={canEdit}
              onChange={(event) =>
                setNextStep(event.target.value as InstructorApplicationNextStepValue | "")
              }
              disabled={!canEdit}
            >
              <option value="">Choose…</option>
              {INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className={compact ? EDITOR_CALLOUT.replace("px-3.5 py-2.5", "px-3 py-2") : EDITOR_CALLOUT}>
            {compact
              ? "Your ratings go to the lead reviewer."
              : "Your review will inform the lead reviewer's official next-step decision."}
            <input type="hidden" name="nextStep" value="" />
          </div>
        )}

        {moveToInterviewNeedsLead ? (
          <div className={EDITOR_WARNING}>
            {compact
              ? "Assign a lead interviewer before moving to interview."
              : "Assign a lead interviewer before submitting Move to Interview. The lead will send exactly 3 proposed times to the applicant."}
          </div>
        ) : null}

        {showApplicantMessage ? (
          <label className={FIELD_LABEL}>
            {compact ? "Message to applicant" : "Applicant-Facing Message"}
            <textarea
              className={FIELD_INPUT}
              name="applicantMessage"
              rows={compact ? 2 : 3}
              value={applicantMessage}
              required={canEdit}
              disabled={!canEdit}
              onChange={(event) => setApplicantMessage(event.target.value)}
              placeholder={
                compact
                  ? "Used if you request info or reject."
                  : "This message will be used when asking for more information or rejecting the application."
              }
            />
          </label>
        ) : (
          <input type="hidden" name="applicantMessage" value={applicantMessage} />
        )}

        {!compact ? (
          <>
            <label className={CHECKBOX_ROW}>
              <input
                type="checkbox"
                checked={flagForLeadership}
                disabled={!canEdit}
                onChange={(event) => setFlagForLeadership(event.target.checked)}
              />
              Flag for leadership discussion
            </label>
            <input type="hidden" name="flagForLeadership" value={flagForLeadership ? "true" : "false"} />
          </>
        ) : (
          <input type="hidden" name="flagForLeadership" value="false" />
        )}
      </div>

      <div className={EDITOR_ACTIONS}>
        {!compact ? (
          <button
            className={buttonVariants({ variant: "secondary", size: "md" })}
            type="submit"
            name="intent"
            value="save"
            disabled={!canEdit}
            formNoValidate
          >
            Save Draft
          </button>
        ) : null}
        <button
          className={buttonVariants({ variant: "primary", size: compact ? "sm" : "md" })}
          type="submit"
          name="intent"
          value="submit"
          disabled={!canEdit || moveToInterviewNeedsLead}
        >
          {compact ? "Submit review" : "Submit Initial Review"}
        </button>
      </div>
    </form>
  );
}
