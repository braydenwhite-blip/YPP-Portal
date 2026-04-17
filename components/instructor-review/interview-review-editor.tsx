"use client";

import { useMemo, useState } from "react";

import {
  INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS,
  INSTRUCTOR_REVIEW_CATEGORIES,
  PROGRESS_RATING_OPTIONS,
  type InstructorInterviewRecommendationValue,
  type InstructorReviewCategoryValue,
  type ProgressRatingValue,
} from "@/lib/instructor-review-config";

type CategoryState = {
  category: InstructorReviewCategoryValue;
  rating: ProgressRatingValue | null;
  notes: string;
};

type QuestionState = {
  localId: string;
  questionBankId: string | null;
  source: "DEFAULT" | "CUSTOM";
  prompt: string;
  followUpPrompt: string;
  notes: string;
  sortOrder: number;
};

type ReviewSnapshot = {
  status: "DRAFT" | "SUBMITTED";
  overallRating: ProgressRatingValue | null;
  recommendation: InstructorInterviewRecommendationValue | null;
  summary: string | null;
  overallNotes: string | null;
  curriculumFeedback: string | null;
  revisionRequirements: string | null;
  applicantMessage: string | null;
  flagForLeadership: boolean;
  curriculumDraftId: string | null;
  categories: Array<{
    category: InstructorReviewCategoryValue;
    rating: ProgressRatingValue | null;
    notes: string | null;
  }>;
  questionResponses: Array<{
    id: string;
    questionBankId: string | null;
    source: "DEFAULT" | "CUSTOM";
    prompt: string;
    followUpPrompt: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
} | null;

interface InterviewReviewEditorProps {
  action: (formData: FormData) => void;
  applicationId: string;
  returnTo: string;
  initialReview: ReviewSnapshot;
  canEdit: boolean;
  isLeadReviewer: boolean;
  canFinalizeRecommendation: boolean;
  drafts: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
  }>;
  selectedDraftId: string | null;
  questionBank: Array<{
    id: string;
    prompt: string;
    helperText: string | null;
    followUpPrompt: string | null;
    topic: string | null;
    sortOrder: number;
  }>;
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

function buildInitialQuestions(
  initialReview: ReviewSnapshot,
  questionBank: InterviewReviewEditorProps["questionBank"]
) {
  const existing = initialReview?.questionResponses ?? [];
  const defaultQuestions = questionBank.map((question) => {
    const existingResponse = existing.find(
      (response) => response.questionBankId === question.id
    );
    return {
      localId: existingResponse?.id ?? question.id,
      questionBankId: question.id,
      source: "DEFAULT" as const,
      prompt: existingResponse?.prompt ?? question.prompt,
      followUpPrompt: existingResponse?.followUpPrompt ?? question.followUpPrompt ?? "",
      notes: existingResponse?.notes ?? "",
      sortOrder: existingResponse?.sortOrder ?? question.sortOrder,
    };
  });

  const customQuestions = existing
    .filter((response) => response.source === "CUSTOM")
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((response) => ({
      localId: response.id,
      questionBankId: response.questionBankId,
      source: "CUSTOM" as const,
      prompt: response.prompt,
      followUpPrompt: response.followUpPrompt ?? "",
      notes: response.notes ?? "",
      sortOrder: response.sortOrder,
    }));

  return [...defaultQuestions, ...customQuestions];
}

export default function InterviewReviewEditor({
  action,
  applicationId,
  returnTo,
  initialReview,
  canEdit,
  isLeadReviewer,
  canFinalizeRecommendation,
  drafts,
  selectedDraftId,
  questionBank,
}: InterviewReviewEditorProps) {
  const [overallRating, setOverallRating] = useState<ProgressRatingValue | "">(
    initialReview?.overallRating ?? ""
  );
  const [recommendation, setRecommendation] = useState<InstructorInterviewRecommendationValue | "">(
    initialReview?.recommendation ?? ""
  );
  const [summary, setSummary] = useState(initialReview?.summary ?? "");
  const [overallNotes, setOverallNotes] = useState(initialReview?.overallNotes ?? "");
  const [curriculumFeedback, setCurriculumFeedback] = useState(
    initialReview?.curriculumFeedback ?? ""
  );
  const [revisionRequirements, setRevisionRequirements] = useState(
    initialReview?.revisionRequirements ?? ""
  );
  const [applicantMessage, setApplicantMessage] = useState(
    initialReview?.applicantMessage ?? ""
  );
  const [flagForLeadership, setFlagForLeadership] = useState(
    initialReview?.flagForLeadership ?? false
  );
  const [curriculumDraftId, setCurriculumDraftId] = useState(
    initialReview?.curriculumDraftId ?? selectedDraftId ?? ""
  );
  const [categories, setCategories] = useState<CategoryState[]>(
    buildInitialCategories(initialReview)
  );
  const [questions, setQuestions] = useState<QuestionState[]>(
    buildInitialQuestions(initialReview, questionBank)
  );

  const questionPayload = useMemo(
    () =>
      JSON.stringify(
        questions.map((question, index) => ({
          questionBankId: question.questionBankId,
          source: question.source,
          prompt: question.prompt,
          followUpPrompt: question.followUpPrompt,
          notes: question.notes,
          sortOrder: index,
        }))
      ),
    [questions]
  );

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

  const showRecommendation =
    isLeadReviewer && canFinalizeRecommendation;
  const showRevisionRequirements = recommendation === "ACCEPT_WITH_REVISIONS";
  const showApplicantMessage = recommendation === "REJECT";

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

  function updateQuestion(
    localId: string,
    field: keyof QuestionState,
    value: string | number
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === localId ? { ...question, [field]: value } : question
      )
    );
  }

  function addCustomQuestion() {
    setQuestions((current) => [
      ...current,
      {
        localId: `custom-${Date.now()}`,
        questionBankId: null,
        source: "CUSTOM",
        prompt: "",
        followUpPrompt: "",
        notes: "",
        sortOrder: current.length,
      },
    ]);
  }

  function removeCustomQuestion(localId: string) {
    setQuestions((current) => current.filter((question) => question.localId !== localId));
  }

  return (
    <form action={action} className="form-grid">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="categoriesJson" value={categoryPayload} />
      <input type="hidden" name="questionResponsesJson" value={questionPayload} />

      {!canEdit ? (
        <div className="card" style={{ background: "#f8fafc", border: "1px solid var(--border)" }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            This interview review is locked because it has already been submitted. An admin can still edit it if needed.
          </p>
        </div>
      ) : null}

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>Overall Interview Evaluation</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            The interview should assess both the person and the draft they bring into the conversation.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {PROGRESS_RATING_OPTIONS.map((option) => {
            const selected = overallRating === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!canEdit}
                onClick={() => setOverallRating(option.value)}
                style={{
                  borderRadius: 10,
                  border: selected ? `2px solid ${option.color}` : "1px solid var(--border)",
                  background: selected ? option.bg : "var(--surface)",
                  padding: 12,
                  textAlign: "left",
                  cursor: canEdit ? "pointer" : "default",
                }}
              >
                <div style={{ fontWeight: 700, color: option.color }}>{option.label}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {option.description}
                </div>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="overallRating" value={overallRating} />

        {showRecommendation ? (
          <label className="form-row">
            Final recommendation
            <select
              className="input"
              name="recommendation"
              value={recommendation}
              onChange={(event) =>
                setRecommendation(
                  event.target.value as InstructorInterviewRecommendationValue | ""
                )
              }
              disabled={!canEdit}
            >
              <option value="">Choose the final recommendation</option>
              {INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              fontSize: 14,
              color: "var(--muted)",
            }}
          >
            Your interview evaluation will inform the lead reviewer’s final recommendation.
            <input type="hidden" name="recommendation" value="" />
          </div>
        )}
      </div>

      <div className="card" style={{ display: "grid", gap: 18 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>Interview Categories</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Keep the same category language from the application review so interview signals stack naturally on top of the initial screening.
          </p>
        </div>

        {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
          const current = categories.find((entry) => entry.category === category.key)!;
          return (
            <div
              key={category.key}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{category.label}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  {category.description}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {PROGRESS_RATING_OPTIONS.map((option) => {
                  const selected = current.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateCategoryRating(category.key, option.value)}
                      style={{
                        borderRadius: 10,
                        border: selected ? `2px solid ${option.color}` : "1px solid var(--border)",
                        background: selected ? option.bg : "var(--surface)",
                        padding: 10,
                        textAlign: "left",
                        cursor: canEdit ? "pointer" : "default",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: option.color }}>{option.shortLabel}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        {option.helperLabel}
                      </div>
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
                  placeholder="Optional category-specific note..."
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>Lesson Design Studio Draft Review</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            Choose the draft this interview review is referencing, then capture curriculum-specific feedback below.
          </p>
        </div>

        {drafts.length > 0 ? (
          <label className="form-row">
            Draft being reviewed
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
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              fontSize: 14,
            }}
          >
            No curriculum draft is currently available for this applicant.
          </div>
        )}

        <label className="form-row">
          Curriculum feedback
          <textarea
            className="input"
            name="curriculumFeedback"
            rows={4}
            value={curriculumFeedback}
            disabled={!canEdit}
            onChange={(event) => setCurriculumFeedback(event.target.value)}
            placeholder="How realistic, teachable, and well-structured is the draft?"
          />
        </label>

        <label className="form-row">
          Required revisions
          <textarea
            className="input"
            name="revisionRequirements"
            rows={3}
            value={revisionRequirements}
            disabled={!canEdit}
            onChange={(event) => setRevisionRequirements(event.target.value)}
            placeholder="List the draft revisions that must happen before approval, if any."
          />
        </label>
      </div>

      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>Interview Questions</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              Every interview includes the shared default bank. Add custom follow-up questions only when the candidate needs them.
            </p>
          </div>
          <button type="button" className="button secondary" onClick={addCustomQuestion} disabled={!canEdit}>
            Add Custom Question
          </button>
        </div>

        {questions.map((question, index) => {
          const isCustom = question.source === "CUSTOM";
          const helperText =
            question.questionBankId
              ? questionBank.find((entry) => entry.id === question.questionBankId)?.helperText ?? null
              : null;

          return (
            <div
              key={question.localId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {isCustom ? `Custom Question ${index + 1}` : `Question ${index + 1}`}
                  </div>
                  {helperText ? (
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {helperText}
                    </div>
                  ) : null}
                </div>
                {isCustom ? (
                  <button
                    type="button"
                    className="button small outline"
                    onClick={() => removeCustomQuestion(question.localId)}
                    disabled={!canEdit}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <label className="form-row" style={{ margin: 0 }}>
                Prompt
                <textarea
                  className="input"
                  rows={2}
                  value={question.prompt}
                  disabled={!canEdit || !isCustom}
                  onChange={(event) => updateQuestion(question.localId, "prompt", event.target.value)}
                  placeholder="Interview prompt..."
                />
              </label>

              <label className="form-row" style={{ margin: 0 }}>
                Optional follow-up prompt
                <textarea
                  className="input"
                  rows={2}
                  value={question.followUpPrompt}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateQuestion(question.localId, "followUpPrompt", event.target.value)
                  }
                  placeholder="Optional follow-up to probe deeper..."
                />
              </label>

              <label className="form-row" style={{ margin: 0 }}>
                Interviewer notes
                <textarea
                  className="input"
                  rows={3}
                  value={question.notes}
                  disabled={!canEdit}
                  onChange={(event) => updateQuestion(question.localId, "notes", event.target.value)}
                  placeholder="What did the candidate say, and what signal did it give you?"
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <label className="form-row">
          Final interview summary
          <textarea
            className="input"
            name="summary"
            rows={4}
            value={summary}
            disabled={!canEdit}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What matters most after the full interview and curriculum review?"
          />
        </label>

        <label className="form-row">
          Overall interview notes
          <textarea
            className="input"
            name="overallNotes"
            rows={4}
            value={overallNotes}
            disabled={!canEdit}
            onChange={(event) => setOverallNotes(event.target.value)}
            placeholder="Capture anything that does not fit neatly into one category."
          />
        </label>

        {showRevisionRequirements ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              color: "#92400e",
              fontSize: 14,
            }}
          >
            Keep the required revisions field above specific. This recommendation does not approve the candidate yet.
          </div>
        ) : null}

        {showApplicantMessage ? (
          <label className="form-row">
            Applicant-facing rejection message
            <textarea
              className="input"
              name="applicantMessage"
              rows={3}
              value={applicantMessage}
              disabled={!canEdit}
              onChange={(event) => setApplicantMessage(event.target.value)}
              placeholder="This message will be used in the rejection email."
            />
          </label>
        ) : (
          <input type="hidden" name="applicantMessage" value={applicantMessage} />
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
          Submit Interview Review
        </button>
      </div>
    </form>
  );
}
