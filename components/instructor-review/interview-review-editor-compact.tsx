"use client";

import { useMemo, useState, type CSSProperties } from "react";

import { buttonVariants } from "@/components/ui-v2";
import {
  EDITOR_ACTIONS,
  EDITOR_CALLOUT,
  EDITOR_NOTICE,
  EDITOR_WARNING,
  FIELD_INPUT,
  FIELD_LABEL,
  RATING_GRID,
  ratingOptionClass,
} from "./editor-classes";
import {
  INITIAL_REVIEW_RATING_OPTIONS,
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

type QuestionStatus = "UNTOUCHED" | "ASKED" | "SKIPPED";

type AnswerTag =
  | "STRONG_ANSWER"
  | "WEAK_ANSWER"
  | "RED_FLAG"
  | "FOLLOW_UP_NEEDED"
  | "GREAT_COMMUNICATOR"
  | "HIGH_POTENTIAL"
  | "NEEDS_COACHING";

type QuestionState = {
  id: string | null;
  localId: string;
  questionBankId: string | null;
  source: "DEFAULT" | "CUSTOM";
  status: QuestionStatus;
  prompt: string;
  followUpPrompt: string;
  competency: string;
  whyAsked: string;
  notes: string;
  rating: ProgressRatingValue | null;
  tags: AnswerTag[];
  askedAt: string | null;
  skippedAt: string | null;
  sortOrder: number;
};

type ReviewSnapshot = {
  status: "DRAFT" | "SUBMITTED";
  overallRating: ProgressRatingValue | null;
  recommendation: InstructorInterviewRecommendationValue | null;
  revisionRequirements: string | null;
  applicantMessage: string | null;
  flagForLeadership: boolean;
  categories: Array<{
    category: InstructorReviewCategoryValue;
    rating: ProgressRatingValue | null;
    notes: string | null;
  }>;
  questionResponses: Array<{
    id: string;
    questionBankId: string | null;
    source: "DEFAULT" | "CUSTOM";
    status: QuestionStatus;
    prompt: string;
    followUpPrompt: string | null;
    competency: string | null;
    whyAsked: string | null;
    notes: string | null;
    rating: ProgressRatingValue | null;
    tags: AnswerTag[];
    askedAt: Date | string | null;
    skippedAt: Date | string | null;
    sortOrder: number;
  }>;
} | null;

type QuestionBankItem = {
  id: string;
  prompt: string;
  topic: string | null;
  competency: string | null;
  whyItMatters: string | null;
  isMustAsk: boolean;
  sortOrder: number;
};

function compactGoalLabel(label: string): string {
  return label.replace(/^GOAL \d+ — /, "");
}

function dateToInputValue(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
  questionBank: QuestionBankItem[]
): QuestionState[] {
  const existing = initialReview?.questionResponses ?? [];
  const defaultQuestions = questionBank.map((question) => {
    const existingResponse = existing.find(
      (response) => response.questionBankId === question.id
    );
    return {
      id: existingResponse?.id ?? null,
      localId: existingResponse?.id ?? question.id,
      questionBankId: question.id,
      source: "DEFAULT" as const,
      status: existingResponse?.status ?? "UNTOUCHED",
      prompt: existingResponse?.prompt ?? question.prompt,
      followUpPrompt: existingResponse?.followUpPrompt ?? "",
      competency: existingResponse?.competency ?? question.competency ?? question.topic ?? "",
      whyAsked: existingResponse?.whyAsked ?? "",
      notes: existingResponse?.notes ?? "",
      rating: existingResponse?.rating ?? null,
      tags: existingResponse?.tags ?? [],
      askedAt: dateToInputValue(existingResponse?.askedAt),
      skippedAt: dateToInputValue(existingResponse?.skippedAt),
      sortOrder: existingResponse?.sortOrder ?? question.sortOrder,
    };
  });

  const customQuestions = existing
    .filter((response) => response.source === "CUSTOM")
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((response) => ({
      id: response.id,
      localId: response.id,
      questionBankId: response.questionBankId,
      source: "CUSTOM" as const,
      status: response.status ?? "ASKED",
      prompt: response.prompt,
      followUpPrompt: response.followUpPrompt ?? "",
      competency: response.competency ?? "",
      whyAsked: response.whyAsked ?? "",
      notes: response.notes ?? "",
      rating: response.rating ?? null,
      tags: response.tags ?? [],
      askedAt: dateToInputValue(response.askedAt),
      skippedAt: dateToInputValue(response.skippedAt),
      sortOrder: response.sortOrder,
    }));

  return [...defaultQuestions, ...customQuestions];
}

const RECOMMENDATION_TONES: Record<
  InstructorInterviewRecommendationValue,
  { color: string; bg: string }
> = {
  ACCEPT: { color: "#166534", bg: "#dcfce7" },
  ACCEPT_WITH_SUPPORT: { color: "#1e40af", bg: "#dbeafe" },
  HOLD: { color: "#92400e", bg: "#fef3c7" },
  REJECT: { color: "#991b1b", bg: "#fee2e2" },
};

export function InterviewReviewEditorCompact({
  action,
  applicationId,
  returnTo,
  initialReview,
  canEdit,
  canFinalizeRecommendation,
  questionBank,
}: {
  action: (formData: FormData) => void;
  applicationId: string;
  returnTo: string;
  initialReview: ReviewSnapshot;
  canEdit: boolean;
  canFinalizeRecommendation: boolean;
  questionBank: QuestionBankItem[];
}) {
  const [overallRating, setOverallRating] = useState<ProgressRatingValue | "">(
    initialReview?.overallRating ?? ""
  );
  const [recommendation, setRecommendation] = useState<InstructorInterviewRecommendationValue | "">(
    initialReview?.recommendation ?? ""
  );
  const [revisionRequirements, setRevisionRequirements] = useState(
    initialReview?.revisionRequirements ?? ""
  );
  const [applicantMessage, setApplicantMessage] = useState(
    initialReview?.applicantMessage ?? ""
  );
  const [categories, setCategories] = useState<CategoryState[]>(
    buildInitialCategories(initialReview)
  );
  const [questions, setQuestions] = useState<QuestionState[]>(
    buildInitialQuestions(initialReview, questionBank)
  );
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const questionBankById = useMemo(
    () => new Map(questionBank.map((bank) => [bank.id, bank])),
    [questionBank]
  );

  const groupedQuestions = useMemo(() => {
    const groups: Array<{ topic: string; items: QuestionState[] }> = [];
    const indexByTopic = new Map<string, number>();

    for (const question of questions) {
      const bankItem = question.questionBankId
        ? questionBankById.get(question.questionBankId)
        : null;
      const topic =
        question.source === "CUSTOM" ? "Follow-ups" : bankItem?.topic ?? "Interview questions";
      let index = indexByTopic.get(topic);
      if (index === undefined) {
        index = groups.length;
        indexByTopic.set(topic, index);
        groups.push({ topic, items: [] });
      }
      groups[index].items.push(question);
    }

    return groups;
  }, [questionBankById, questions]);

  const questionPayload = useMemo(
    () =>
      JSON.stringify(
        questions.map((question, index) => ({
          id: question.id,
          localId: question.localId,
          questionBankId: question.questionBankId,
          source: question.source,
          status: question.status,
          prompt: question.prompt,
          followUpPrompt: question.followUpPrompt,
          competency: question.competency,
          whyAsked: question.whyAsked,
          notes: question.notes,
          rating: question.rating,
          tags: question.tags,
          askedAt: question.askedAt,
          skippedAt: question.skippedAt,
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

  const showRecommendation = canFinalizeRecommendation;
  const showRevisionRequirements = recommendation === "ACCEPT_WITH_SUPPORT";
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

  function updateCategoryNotes(categoryKey: InstructorReviewCategoryValue, value: string) {
    setCategories((current) =>
      current.map((category) =>
        category.category === categoryKey ? { ...category, notes: value } : category
      )
    );
  }

  function updateQuestionNotes(localId: string, value: string) {
    const now = new Date().toISOString();
    setQuestions((current) =>
      current.map((question) => {
        if (question.localId !== localId) return question;
        const shouldMarkAsked = question.status === "UNTOUCHED" && value.trim().length > 0;
        return {
          ...question,
          notes: value,
          status: shouldMarkAsked ? "ASKED" : question.status,
          askedAt: shouldMarkAsked ? question.askedAt ?? now : question.askedAt,
        };
      })
    );
  }

  function collectMissingFields(): string[] {
    const missing: string[] = [];

    for (const category of INSTRUCTOR_REVIEW_CATEGORIES) {
      const current = categories.find((entry) => entry.category === category.key);
      if (!current?.rating) {
        missing.push(`${compactGoalLabel(category.label)}: rating`);
      }
      if (!current?.notes.trim()) {
        missing.push(`${compactGoalLabel(category.label)}: note`);
      }
    }

    if (!overallRating) {
      missing.push("Overall rating");
    }

    if (canFinalizeRecommendation && !recommendation) {
      missing.push("Recommendation");
    }

    if (recommendation === "ACCEPT_WITH_SUPPORT" && !revisionRequirements.trim()) {
      missing.push("Support notes");
    }

    if (recommendation === "REJECT" && !applicantMessage.trim()) {
      missing.push("Message to applicant");
    }

    for (const question of questions) {
      if (!question.prompt.trim()) {
        missing.push("Question prompt");
        continue;
      }
    }

    return missing;
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value ?? "save";
    if (intent !== "submit") {
      setMissingFields([]);
      return;
    }
    const missing = collectMissingFields();
    if (missing.length > 0) {
      event.preventDefault();
      setMissingFields(missing);
      return;
    }
    setMissingFields([]);
  }

  return (
    <form action={action} onSubmit={handleFormSubmit} className="flex flex-col gap-3">
      <h3 className="m-0 text-[14px] font-bold text-ink">Interview feedback</h3>

      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="categoriesJson" value={categoryPayload} />
      <input type="hidden" name="questionResponsesJson" value={questionPayload} />
      <input type="hidden" name="flagForLeadership" value="false" />

      {!canEdit ? (
        <div className={EDITOR_NOTICE}>
          <p>Already submitted.</p>
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div className={EDITOR_WARNING} role="alert">
          <p className="m-0 text-[12.5px] font-semibold">Finish these before submitting:</p>
          <ul className="m-0 mt-1.5 list-disc pl-5 text-[12.5px]">
            {missingFields.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-[10px] border border-line-soft bg-surface-soft/60 p-3">
        <p className="m-0 text-[12.5px] text-ink-muted">
          Capture notes for each question, then rate the five GOAL areas.
        </p>

        {groupedQuestions.map((group) => (
          <div key={group.topic} className="flex flex-col gap-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              {group.topic}
            </div>
            {group.items.map((question) => {
              const bankItem = question.questionBankId
                ? questionBankById.get(question.questionBankId)
                : null;
              return (
                <div
                  key={question.localId}
                  className="flex flex-col gap-2 rounded-[8px] border border-line bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {question.competency || bankItem?.competency ? (
                      <span className="text-[12px] font-semibold text-ink">
                        {question.competency || bankItem?.competency}
                      </span>
                    ) : null}
                    {bankItem?.isMustAsk ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Must ask
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 text-[13.5px] font-semibold leading-snug text-ink">
                    {question.prompt}
                  </p>
                  {bankItem?.whyItMatters ? (
                    <p className="m-0 text-[12px] leading-relaxed text-ink-muted">
                      {bankItem.whyItMatters}
                    </p>
                  ) : null}
                  <label className={FIELD_LABEL}>
                    Notes
                    <textarea
                      className={FIELD_INPUT}
                      rows={2}
                      value={question.notes}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateQuestionNotes(question.localId, event.target.value)
                      }
                      placeholder="What they said and how strong the answer was."
                    />
                  </label>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-line-soft bg-surface-soft/60 p-3">
        <p className="m-0 text-[12.5px] text-ink-muted">
          Rate each GOAL area. Red = not ready, Green = strong signal.
        </p>

        {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
          const current = categories.find((entry) => entry.category === category.key)!;
          return (
            <div key={category.key} className="flex flex-col gap-2">
              <div className="text-[13px] font-semibold text-ink">
                {compactGoalLabel(category.label)}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {INITIAL_REVIEW_RATING_OPTIONS.map((option) => {
                  const selected = current.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateCategoryRating(category.key, option.value)}
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
              <label className={FIELD_LABEL}>
                Note
                <textarea
                  className={FIELD_INPUT}
                  rows={2}
                  value={current.notes}
                  disabled={!canEdit}
                  onChange={(event) => updateCategoryNotes(category.key, event.target.value)}
                  placeholder="Evidence from the interview."
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-line-soft bg-surface-soft/60 p-3">
        <div className="text-[13px] font-semibold text-ink">Overall</div>
        <div className={RATING_GRID}>
          {PROGRESS_RATING_OPTIONS.map((option) => {
            const selected = overallRating === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!canEdit}
                onClick={() => setOverallRating(option.value)}
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
        <input type="hidden" name="overallRating" value={overallRating} />

        {showRecommendation ? (
          <label className={FIELD_LABEL}>
            Recommendation
            <select
              className={FIELD_INPUT}
              name="recommendation"
              value={recommendation}
              required={canEdit}
              disabled={!canEdit}
              onChange={(event) =>
                setRecommendation(event.target.value as InstructorInterviewRecommendationValue | "")
              }
            >
              <option value="">Choose…</option>
              {INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS.map((option) => {
                const tone = RECOMMENDATION_TONES[option.value];
                return (
                  <option key={option.value} value={option.value} style={{ color: tone.color }}>
                    {option.label}
                  </option>
                );
              })}
            </select>
          </label>
        ) : (
          <div className={EDITOR_CALLOUT.replace("px-3.5 py-2.5", "px-3 py-2")}>
            Your ratings go to the lead reviewer.
            <input type="hidden" name="recommendation" value="" />
          </div>
        )}

        {showRevisionRequirements ? (
          <label className={FIELD_LABEL}>
            Support notes
            <textarea
              className={FIELD_INPUT}
              name="revisionRequirements"
              rows={2}
              value={revisionRequirements}
              disabled={!canEdit}
              onChange={(event) => setRevisionRequirements(event.target.value)}
              placeholder="Coaching or prep required during onboarding."
            />
          </label>
        ) : (
          <input type="hidden" name="revisionRequirements" value={revisionRequirements} />
        )}

        {showApplicantMessage ? (
          <label className={FIELD_LABEL}>
            Message to applicant
            <textarea
              className={FIELD_INPUT}
              name="applicantMessage"
              rows={2}
              value={applicantMessage}
              disabled={!canEdit}
              onChange={(event) => setApplicantMessage(event.target.value)}
              placeholder="Used in the rejection email."
            />
          </label>
        ) : (
          <input type="hidden" name="applicantMessage" value={applicantMessage} />
        )}
      </div>

      <div className={EDITOR_ACTIONS}>
        <button
          className={buttonVariants({ variant: "primary", size: "sm" })}
          type="submit"
          name="intent"
          value="submit"
          disabled={!canEdit}
        >
          Submit feedback
        </button>
      </div>
    </form>
  );
}
