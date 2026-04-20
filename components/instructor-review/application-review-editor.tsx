"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS,
  INSTRUCTOR_REVIEW_CATEGORIES,
  PROGRESS_RATING_OPTIONS,
  type InstructorApplicationNextStepValue,
  type InstructorReviewCategoryValue,
  type ProgressRatingValue,
} from "@/lib/instructor-review-config";

type CategoryState = {
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

interface ApplicationReviewEditorProps {
  action: (formData: FormData) => void;
  applicationId: string;
  returnTo: string;
  initialReview: ReviewSnapshot;
  canEdit: boolean;
  isLeadReviewer: boolean;
  isAdmin: boolean;
  drafts: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
  }>;
  selectedDraftId: string | null;
}

function buildInitialCategories(initialReview: ReviewSnapshot): CategoryState[] {
  return INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
    const existing = initialReview?.categories.find(
      (entry) => entry.category === category.key
    );
    return {
      category: category.key,
      rating: existing?.rating ?? null,
      notes: existing?.notes ?? "",
    };
  });
}

export default function ApplicationReviewEditor({
  action,
  applicationId,
  returnTo,
  initialReview,
  canEdit,
  isLeadReviewer,
  drafts,
  selectedDraftId,
}: ApplicationReviewEditorProps) {
  const [overallRating, setOverallRating] = useState<ProgressRatingValue | "">(
    initialReview?.overallRating ?? ""
  );
  const [nextStep, setNextStep] = useState<InstructorApplicationNextStepValue | "">(
    initialReview?.nextStep ?? ""
  );
  const [summary, setSummary] = useState(initialReview?.summary ?? "");
  const [notes, setNotes] = useState(initialReview?.notes ?? "");
  const [concerns, setConcerns] = useState(initialReview?.concerns ?? "");
  const [applicantMessage, setApplicantMessage] = useState(
    initialReview?.applicantMessage ?? ""
  );
  const [flagForLeadership, setFlagForLeadership] = useState(
    initialReview?.flagForLeadership ?? false
  );
  const [draftOverrideUsed, setDraftOverrideUsed] = useState(
    initialReview?.draftOverrideUsed ?? false
  );
  const [draftOverrideReason, setDraftOverrideReason] = useState(
    initialReview?.draftOverrideReason ?? ""
  );
  const [curriculumDraftId, setCurriculumDraftId] = useState(
    initialReview?.curriculumDraftId ?? selectedDraftId ?? ""
  );
  const [categories, setCategories] = useState<CategoryState[]>(
    buildInitialCategories(initialReview)
  );

  const showApplicantMessage =
    isLeadReviewer && (nextStep === "REQUEST_INFO" || nextStep === "REJECT");
  const movingToInterviewWithoutDraft =
    isLeadReviewer && drafts.length === 0 && nextStep === "MOVE_TO_INTERVIEW";
  const showDraftOverride = movingToInterviewWithoutDraft;

  const categoryPayload = useMemo(
    () =>
      JSON.stringify(
        categories.map((category) => ({
          category: category.category,
          rating: category.rating,
          notes: category.notes,
        }))
      ),
    [categories]
  );

  function updateCategoryRating(
    categoryKey: InstructorReviewCategoryValue,
    rating: ProgressRatingValue
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.category === categoryKey ? { ...category, rating } : category
      )
    );
  }

  function updateCategoryNotes(
    categoryKey: InstructorReviewCategoryValue,
    value: string
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.category === categoryKey ? { ...category, notes: value } : category
      )
    );
  }

  return (
    <form action={action} className="form-grid application-review-editor">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="categoriesJson" value={categoryPayload} />
      <input
        type="hidden"
        name="draftOverrideUsed"
        value={draftOverrideUsed || movingToInterviewWithoutDraft ? "true" : "false"}
      />

      {!canEdit ? (
        <div className="review-editor-notice">
          <p>
            This review is locked because it has already been submitted. An admin can still edit it if needed.
          </p>
        </div>
      ) : null}

      <div className="review-editor-panel">
        <div>
          <h2>Overall Application Evaluation</h2>
          <p>
            Use the same mentorship color language so application review feels consistent with the rest of the portal.
          </p>
        </div>

        <div className="review-rating-grid">
          {PROGRESS_RATING_OPTIONS.map((option) => {
            const selected = overallRating === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!canEdit}
                onClick={() => setOverallRating(option.value)}
                className={`review-rating-option${selected ? " is-selected" : ""}`}
                style={{ "--rating-color": option.color, "--rating-bg": option.bg } as CSSProperties}
              >
                <div>{option.label}</div>
                <span>
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="overallRating" value={overallRating} />

        {isLeadReviewer ? (
          <label className="form-row">
            Next Step
            <select
              className="input"
              name="nextStep"
              value={nextStep}
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
            Your review will inform the lead reviewer’s official next-step decision.
            <input type="hidden" name="nextStep" value="" />
          </div>
        )}
      </div>

      <div className="review-editor-panel">
        <div>
          <h2>Category Evaluations</h2>
          <p>
            Rate each category, then add a short internal note only if it helps future reviewers scan faster.
          </p>
        </div>

        {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
          const current = categories.find((entry) => entry.category === category.key)!;
          return (
            <div
              key={category.key}
              className="review-category-card"
            >
              <div>
                <div className="review-category-title">{category.label}</div>
                <div className="review-category-description">
                  {category.description}
                </div>
              </div>

              <div className="review-rating-grid review-rating-grid-compact">
                {PROGRESS_RATING_OPTIONS.map((option) => {
                  const selected = current.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateCategoryRating(category.key, option.value)}
                      className={`review-rating-option${selected ? " is-selected" : ""}`}
                      style={{ "--rating-color": option.color, "--rating-bg": option.bg } as CSSProperties}
                    >
                      <div>{option.shortLabel}</div>
                      <span>
                        {option.helperLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="form-row" style={{ margin: 0 }}>
                Internal note
                <textarea
                  className="input"
                  rows={2}
                  value={current.notes}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateCategoryNotes(category.key, event.target.value)
                  }
                  placeholder="Optional note for reviewers..."
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="review-editor-panel">
        <div>
          <h2>Lesson Design Studio Draft</h2>
          <p>
            If a draft is available, attach it to the review. If it is missing, the review can still move forward with a note.
          </p>
        </div>

        {drafts.length > 0 ? (
          <label className="form-row">
            Draft to reference in this review
            <select
              className="input"
              name="curriculumDraftId"
              value={curriculumDraftId}
              onChange={(event) => setCurriculumDraftId(event.target.value)}
              disabled={!canEdit}
            >
              {drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {(draft.title || "Untitled curriculum").trim()} · {draft.status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="review-editor-warning">
            No Lesson Design Studio draft exists yet for this applicant.
          </div>
        )}

        {showDraftOverride ? (
          <div className="review-editor-warning review-editor-warning-grid">
            <label className="review-checkbox-row">
              <input
                type="checkbox"
                checked={draftOverrideUsed || movingToInterviewWithoutDraft}
                disabled={!canEdit}
                onChange={(event) => setDraftOverrideUsed(event.target.checked)}
              />
              Continue to interview without a Lesson Design Studio draft
            </label>
            {draftOverrideUsed || movingToInterviewWithoutDraft ? (
              <label className="form-row" style={{ margin: 0 }}>
                Missing-draft note
                <textarea
                  className="input"
                  name="draftOverrideReason"
                  rows={2}
                  value={draftOverrideReason}
                  disabled={!canEdit}
                  onChange={(event) => setDraftOverrideReason(event.target.value)}
                  placeholder="Optional: explain what is missing or what should be checked during the interview..."
                />
              </label>
            ) : (
              <input type="hidden" name="draftOverrideReason" value="" />
            )}
          </div>
        ) : (
          <input type="hidden" name="draftOverrideReason" value={draftOverrideReason} />
        )}
      </div>

      <div className="review-editor-panel">
        <label className="form-row">
          Lead summary
          <textarea
            className="input"
            name="summary"
            rows={4}
            value={summary}
            disabled={!canEdit}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What matters most about this applicant at this stage?"
          />
        </label>

        <label className="form-row">
          Internal notes
          <textarea
            className="input"
            name="notes"
            rows={4}
            value={notes}
            disabled={!canEdit}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Extra context for reviewers and leadership..."
          />
        </label>

        <label className="form-row">
          Concerns or blockers
          <textarea
            className="input"
            name="concerns"
            rows={3}
            value={concerns}
            disabled={!canEdit}
            onChange={(event) => setConcerns(event.target.value)}
            placeholder="Specific concerns, gaps, or things to watch..."
          />
        </label>

        {showApplicantMessage ? (
          <label className="form-row">
            Applicant-facing message
            <textarea
              className="input"
              name="applicantMessage"
              rows={3}
              value={applicantMessage}
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
        >
          Save Draft
        </button>
        <button className="button" type="submit" name="intent" value="submit" disabled={!canEdit}>
          Submit Review
        </button>
      </div>
    </form>
  );
}
