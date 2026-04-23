"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

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
  summary: string | null;
  overallNotes: string | null;
  demeanorNotes: string | null;
  maturityNotes: string | null;
  communicationNotes: string | null;
  professionalismNotes: string | null;
  followUpItems: string | null;
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
  slug: string;
  prompt: string;
  helperText: string | null;
  followUpPrompt: string | null;
  topic: string | null;
  competency: string | null;
  whyItMatters: string | null;
  interviewerGuidance: string | null;
  listenFor: string | null;
  suggestedFollowUps: unknown;
  strongSignals: unknown;
  concernSignals: unknown;
  notePrompts: unknown;
  sortOrder: number;
};

type LiveDraftInput = {
  applicationId: string;
  categoriesJson: string;
  questionResponsesJson: string;
  overallRating: string | null;
  recommendation: string | null;
  summary: string | null;
  overallNotes: string | null;
  demeanorNotes: string | null;
  maturityNotes: string | null;
  communicationNotes: string | null;
  professionalismNotes: string | null;
  followUpItems: string | null;
  revisionRequirements: string | null;
  applicantMessage: string | null;
  flagForLeadership: boolean;
};

interface InterviewReviewEditorProps {
  action: (formData: FormData) => void;
  liveDraftAction: (input: LiveDraftInput) => Promise<{
    success: boolean;
    savedAt?: string;
    reviewId?: string;
    error?: string;
  }>;
  applicationId: string;
  returnTo: string;
  initialReview: ReviewSnapshot;
  canEdit: boolean;
  isLeadReviewer: boolean;
  canFinalizeRecommendation: boolean;
  questionBank: QuestionBankItem[];
}

const TAG_OPTIONS: Array<{ value: AnswerTag; label: string; tone: string }> = [
  { value: "STRONG_ANSWER", label: "Strong Answer", tone: "success" },
  { value: "WEAK_ANSWER", label: "Weak Answer", tone: "warning" },
  { value: "RED_FLAG", label: "Red Flag", tone: "danger" },
  { value: "FOLLOW_UP_NEEDED", label: "Follow Up Needed", tone: "info" },
  { value: "GREAT_COMMUNICATOR", label: "Great Communicator", tone: "success" },
  { value: "HIGH_POTENTIAL", label: "High Potential", tone: "success" },
  { value: "NEEDS_COACHING", label: "Needs Coaching", tone: "warning" },
];

function RequiredStar() {
  return (
    <span className="required-star" aria-hidden="true">
      *
    </span>
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
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
) {
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
      followUpPrompt: existingResponse?.followUpPrompt ?? question.followUpPrompt ?? "",
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

function labelFromStatus(status: QuestionStatus) {
  if (status === "ASKED") return "Asked";
  if (status === "SKIPPED") return "Skipped";
  return "Not Started";
}

function statusClass(status: QuestionStatus) {
  if (status === "ASKED") return "is-asked";
  if (status === "SKIPPED") return "is-skipped";
  return "is-untouched";
}

export default function InterviewReviewEditor({
  action,
  liveDraftAction,
  applicationId,
  returnTo,
  initialReview,
  canEdit,
  isLeadReviewer,
  canFinalizeRecommendation,
  questionBank,
}: InterviewReviewEditorProps) {
  const [overallRating, setOverallRating] = useState<ProgressRatingValue | "">(
    initialReview?.overallRating ?? ""
  );
  const [recommendation, setRecommendation] = useState<InstructorInterviewRecommendationValue | "">(
    initialReview?.recommendation ?? ""
  );
  const [summary, setSummary] = useState(initialReview?.summary ?? "");
  const [revisionRequirements, setRevisionRequirements] = useState(
    initialReview?.revisionRequirements ?? ""
  );
  const [applicantMessage, setApplicantMessage] = useState(
    initialReview?.applicantMessage ?? ""
  );
  const [flagForLeadership, setFlagForLeadership] = useState(
    initialReview?.flagForLeadership ?? false
  );
  const [categories, setCategories] = useState<CategoryState[]>(
    buildInitialCategories(initialReview)
  );
  const [questions, setQuestions] = useState<QuestionState[]>(
    buildInitialQuestions(initialReview, questionBank)
  );
  const [activeQuestionId, setActiveQuestionId] = useState(
    questions[0]?.localId ?? ""
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const mountedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);

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

  const livePayload = useMemo<LiveDraftInput>(
    () => ({
      applicationId,
      categoriesJson: categoryPayload,
      questionResponsesJson: questionPayload,
      overallRating: overallRating || null,
      recommendation: recommendation || null,
      summary: summary || null,
      overallNotes: null,
      demeanorNotes: null,
      maturityNotes: null,
      communicationNotes: null,
      professionalismNotes: null,
      followUpItems: null,
      revisionRequirements: revisionRequirements || null,
      applicantMessage: applicantMessage || null,
      flagForLeadership,
    }),
    [
      applicationId,
      applicantMessage,
      categoryPayload,
      flagForLeadership,
      overallRating,
      questionPayload,
      recommendation,
      revisionRequirements,
      summary,
    ]
  );
  const livePayloadRef = useRef(livePayload);

  const activeQuestion =
    questions.find((question) => question.localId === activeQuestionId) ?? questions[0] ?? null;
  const activeBankItem = activeQuestion?.questionBankId
    ? questionBank.find((question) => question.id === activeQuestion.questionBankId)
    : null;

  const progress = useMemo(() => {
    const asked = questions.filter((question) => question.status === "ASKED").length;
    const skipped = questions.filter((question) => question.status === "SKIPPED").length;
    const untouched = questions.length - asked - skipped;
    const redFlags = questions.filter((question) => question.tags.includes("RED_FLAG")).length;
    const followUps = questions.filter((question) => question.tags.includes("FOLLOW_UP_NEEDED")).length;
    const incompleteAsked = questions.filter(
      (question) => question.status === "ASKED" && !question.notes.trim()
    ).length;
    const sections = questions.reduce<Record<string, { total: number; asked: number }>>(
      (acc, question) => {
        const key = question.competency || activeBankItem?.topic || "Interview";
        const entry = acc[key] ?? { total: 0, asked: 0 };
        entry.total += 1;
        if (question.status === "ASKED") entry.asked += 1;
        acc[key] = entry;
        return acc;
      },
      {}
    );
    return { asked, skipped, untouched, redFlags, followUps, incompleteAsked, sections };
  }, [activeBankItem?.topic, questions]);

  const showRecommendation = canFinalizeRecommendation;
  const showRevisionRequirements = recommendation === "ACCEPT_WITH_SUPPORT";
  const showApplicantMessage = recommendation === "REJECT";

  async function runLiveSave(reason: "auto" | "manual") {
    if (!canEdit) return;
    const seq = saveSeqRef.current + 1;
    saveSeqRef.current = seq;
    setSaveStatus("saving");
    setSaveMessage(reason === "manual" ? "Saving now…" : "Autosaving…");
    const result = await liveDraftAction(livePayloadRef.current);
    if (seq !== saveSeqRef.current) return;
    if (result.success) {
      setSaveStatus("saved");
      const savedAt = result.savedAt ? new Date(result.savedAt) : new Date();
      setSaveMessage(`Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    } else {
      setSaveStatus("error");
      setSaveMessage(result.error ?? "Draft could not be saved.");
    }
  }

  useEffect(() => {
    livePayloadRef.current = livePayload;
    if (!canEdit) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setSaveStatus("dirty");
    setSaveMessage("Unsaved changes");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void runLiveSave("auto");
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [canEdit, livePayload]);

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
    updater: (question: QuestionState) => QuestionState
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === localId ? updater(question) : question
      )
    );
  }

  function setQuestionStatus(localId: string, status: QuestionStatus) {
    const now = new Date().toISOString();
    updateQuestion(localId, (question) => ({
      ...question,
      status,
      askedAt: status === "ASKED" ? question.askedAt ?? now : null,
      skippedAt: status === "SKIPPED" ? question.skippedAt ?? now : null,
    }));
  }

  function toggleTag(localId: string, tag: AnswerTag) {
    updateQuestion(localId, (question) => ({
      ...question,
      tags: question.tags.includes(tag)
        ? question.tags.filter((entry) => entry !== tag)
        : [...question.tags, tag],
    }));
  }

  function addCustomQuestion() {
    const localId = `custom-${Date.now()}`;
    setQuestions((current) => [
      ...current,
      {
        id: null,
        localId,
        questionBankId: null,
        source: "CUSTOM",
        status: "ASKED",
        prompt: "",
        followUpPrompt: "",
        competency: "",
        whyAsked: "",
        notes: "",
        rating: null,
        tags: ["FOLLOW_UP_NEEDED"],
        askedAt: new Date().toISOString(),
        skippedAt: null,
        sortOrder: current.length,
      },
    ]);
    setActiveQuestionId(localId);
  }

  function removeCustomQuestion(localId: string) {
    setQuestions((current) => current.filter((question) => question.localId !== localId));
    if (activeQuestionId === localId) {
      const nextQuestion = questions.find((question) => question.localId !== localId);
      setActiveQuestionId(nextQuestion?.localId ?? "");
    }
  }

  function collectMissingFields(): string[] {
    const missing: string[] = [];

    for (const category of INSTRUCTOR_REVIEW_CATEGORIES) {
      const current = categories.find((entry) => entry.category === category.key);
      if (!current?.rating) {
        missing.push(`${category.label}: rating`);
      }
      if (!current?.notes.trim()) {
        missing.push(`${category.label}: note`);
      }
    }

    if (!overallRating) {
      missing.push("Overall interview evaluation rating");
    }

    if (canFinalizeRecommendation && !recommendation) {
      missing.push("Final recommendation");
    }

    if (recommendation === "ACCEPT_WITH_SUPPORT" && !revisionRequirements.trim()) {
      missing.push("Required support notes");
    }

    if (recommendation === "REJECT" && !applicantMessage.trim()) {
      missing.push("Applicant-facing rejection message");
    }

    for (const question of questions) {
      if (!question.prompt.trim()) {
        missing.push(`Question prompt (${question.competency || "custom"})`);
        continue;
      }
      if (question.status === "ASKED" && !question.notes.trim()) {
        missing.push(`Notes for "${question.prompt.slice(0, 60)}${question.prompt.length > 60 ? "…" : ""}"`);
      }
    }

    return missing;
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const intent = submitter?.value ?? "save";
    if (intent !== "submit") {
      setMissingFields([]);
      return;
    }
    const missing = collectMissingFields();
    if (missing.length > 0) {
      event.preventDefault();
      setMissingFields(missing);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    setMissingFields([]);
  }

  return (
    <form action={action} onSubmit={handleFormSubmit} className="live-interview-workspace">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="categoriesJson" value={categoryPayload} />
      <input type="hidden" name="questionResponsesJson" value={questionPayload} />

      {!canEdit ? (
        <div className="review-editor-notice">
          <p>
            This interview review is locked because it has already been submitted. An admin can still edit it if needed.
          </p>
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div className="review-editor-missing" role="alert">
          <h3>Just a few things to finish before submitting</h3>
          <p>
            Save the draft any time. When you&apos;re ready to submit, please fill in:
          </p>
          <ul>
            {missingFields.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="live-interview-hero">
        <div>
          <span className="cockpit-section-kicker">During-interview workflow</span>
          <h2>Live Question Runner</h2>
          <p>
            Move through questions, capture notes while answers are fresh, tag signals, and save as you go.
          </p>
        </div>
        <div className={`live-save-chip is-${saveStatus}`} aria-live="polite">
          <span>{saveStatus === "idle" ? "Ready" : saveMessage}</span>
          <button
            type="button"
            className="button small outline"
            disabled={!canEdit || saveStatus === "saving"}
            onClick={() => void runLiveSave("manual")}
          >
            Save Now
          </button>
        </div>
      </section>

      <section className="live-interview-grid">
        <aside className="live-progress-rail" aria-label="Interview progress">
          <div className="live-progress-counts">
            <div>
              <strong>{progress.asked}</strong>
              <span>Asked</span>
            </div>
            <div>
              <strong>{progress.skipped}</strong>
              <span>Skipped</span>
            </div>
            <div>
              <strong>{progress.untouched}</strong>
              <span>Left</span>
            </div>
          </div>

          <div className="live-progress-alerts">
            <span className={progress.redFlags > 0 ? "is-danger" : ""}>
              {progress.redFlags} red flag{progress.redFlags === 1 ? "" : "s"}
            </span>
            <span className={progress.followUps > 0 ? "is-info" : ""}>
              {progress.followUps} follow-up{progress.followUps === 1 ? "" : "s"}
            </span>
            <span className={progress.incompleteAsked > 0 ? "is-warning" : ""}>
              {progress.incompleteAsked} incomplete
            </span>
          </div>

          <div className="live-section-list">
            {Object.entries(progress.sections).map(([section, value]) => (
              <div key={section}>
                <span>{section}</span>
                <strong>
                  {value.asked}/{value.total}
                </strong>
              </div>
            ))}
          </div>

          <div className="live-question-nav">
            {questions.map((question, index) => (
              <button
                key={question.localId}
                type="button"
                className={`live-question-nav-item ${statusClass(question.status)}${
                  question.localId === activeQuestion?.localId ? " is-active" : ""
                }`}
                onClick={() => setActiveQuestionId(question.localId)}
              >
                <span>{index + 1}</span>
                <strong>{question.competency || "Custom"}</strong>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="button secondary live-add-question-button"
            onClick={addCustomQuestion}
            disabled={!canEdit}
          >
            Add Follow-Up Question
          </button>
        </aside>

        {activeQuestion ? (
          <article className={`live-question-card ${statusClass(activeQuestion.status)}`}>
            <div className="live-question-card-header">
              <div>
                <span className="cockpit-section-kicker">
                  {activeQuestion.source === "CUSTOM" ? "Custom follow-up" : activeBankItem?.topic ?? "Interview question"}
                </span>
                <h3>{activeQuestion.competency || "Live interview question"}</h3>
              </div>
              <span className={`live-status-pill ${statusClass(activeQuestion.status)}`}>
                {labelFromStatus(activeQuestion.status)}
              </span>
            </div>

            {activeQuestion.source === "CUSTOM" ? (
              <div className="live-custom-grid">
                <label className="form-row">
                  Custom question
                  <textarea
                    className="input"
                    rows={3}
                    value={activeQuestion.prompt}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateQuestion(activeQuestion.localId, (question) => ({
                        ...question,
                        prompt: event.target.value,
                      }))
                    }
                    placeholder="Ask the follow-up exactly how you want it saved..."
                  />
                </label>
                <label className="form-row">
                  Competency
                  <input
                    className="input"
                    value={activeQuestion.competency}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateQuestion(activeQuestion.localId, (question) => ({
                        ...question,
                        competency: event.target.value,
                      }))
                    }
                    placeholder="Example: Communication, coachability, student support..."
                  />
                </label>
                <label className="form-row">
                  Why it was asked
                  <textarea
                    className="input"
                    rows={2}
                    value={activeQuestion.whyAsked}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateQuestion(activeQuestion.localId, (question) => ({
                        ...question,
                        whyAsked: event.target.value,
                      }))
                    }
                    placeholder="What signal or gap made this follow-up useful?"
                  />
                </label>
              </div>
            ) : (
              <>
                <p className="live-question-text">{activeQuestion.prompt}</p>
                {activeBankItem?.whyItMatters ? (
                  <p className="live-guidance-callout">{activeBankItem.whyItMatters}</p>
                ) : null}
              </>
            )}

            <div className="live-status-actions" role="group" aria-label="Question status">
              <button
                type="button"
                className={activeQuestion.status === "ASKED" ? "is-selected" : ""}
                disabled={!canEdit}
                onClick={() => setQuestionStatus(activeQuestion.localId, "ASKED")}
              >
                Mark Asked
              </button>
              <button
                type="button"
                className={activeQuestion.status === "SKIPPED" ? "is-selected" : ""}
                disabled={!canEdit}
                onClick={() => setQuestionStatus(activeQuestion.localId, "SKIPPED")}
              >
                Mark Skipped
              </button>
            </div>

            {activeBankItem ? (
              <div className="live-guidance-grid">
                <div>
                  <h4>Strong Signals</h4>
                  <ul>
                    {asStringArray(activeBankItem.strongSignals).map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Concern Signals</h4>
                  <ul>
                    {asStringArray(activeBankItem.concernSignals).map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <label className="form-row">
              Follow-up asked or planned
              <textarea
                className="input"
                rows={2}
                value={activeQuestion.followUpPrompt}
                disabled={!canEdit}
                onChange={(event) =>
                  updateQuestion(activeQuestion.localId, (question) => ({
                    ...question,
                    followUpPrompt: event.target.value,
                  }))
                }
                placeholder={
                  activeBankItem
                    ? asStringArray(activeBankItem.suggestedFollowUps)[0] ?? "Capture the follow-up you asked..."
                    : "Capture the custom follow-up or next probe..."
                }
              />
            </label>

            {activeBankItem && asStringArray(activeBankItem.suggestedFollowUps).length > 0 ? (
              <div className="live-followup-suggestions">
                {asStringArray(activeBankItem.suggestedFollowUps).map((followUp) => (
                  <button
                    key={followUp}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      updateQuestion(activeQuestion.localId, (question) => ({
                        ...question,
                        followUpPrompt: question.followUpPrompt
                          ? `${question.followUpPrompt}\n${followUp}`
                          : followUp,
                      }))
                    }
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            ) : null}

            <label className="form-row">
              <span>
                Notes on candidate answer
                {activeQuestion.status === "ASKED" ? <RequiredStar /> : null}
              </span>
              <textarea
                className="input live-notes-input"
                rows={7}
                value={activeQuestion.notes}
                disabled={!canEdit}
                onChange={(event) =>
                  updateQuestion(activeQuestion.localId, (question) => ({
                    ...question,
                    notes: event.target.value,
                  }))
                }
                placeholder={
                  activeBankItem
                    ? asStringArray(activeBankItem.notePrompts).join(" / ") ||
                      "Capture evidence, examples, concerns, and exact phrasing while it is fresh."
                    : "Capture the answer, signal, and why this follow-up mattered."
                }
              />
            </label>

            <div className="live-tag-block">
              <h4>Answer Tags</h4>
              <div>
                {TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    className={`live-tag-chip is-${tag.tone}${
                      activeQuestion.tags.includes(tag.value) ? " is-selected" : ""
                    }`}
                    disabled={!canEdit}
                    onClick={() => toggleTag(activeQuestion.localId, tag.value)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {activeQuestion.source === "CUSTOM" ? (
              <button
                type="button"
                className="button small outline"
                disabled={!canEdit}
                onClick={() => removeCustomQuestion(activeQuestion.localId)}
              >
                Remove Custom Question
              </button>
            ) : null}
          </article>
        ) : (
          <div className="review-editor-notice">
            <p>No interview questions are available yet.</p>
          </div>
        )}
      </section>

      <section className="review-editor-panel">
        <div>
          <h2>
            Overall Interview Evaluation
            <RequiredStar />
          </h2>
          <p>Your per-question and per-category notes roll up into this final interview judgment.</p>
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
                style={
                  {
                    "--rating-color": option.color,
                    "--rating-bg": option.bg,
                  } as CSSProperties
                }
              >
                <div>{option.label}</div>
                <span>{option.description}</span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="overallRating" value={overallRating} />

        {showRecommendation ? (
          <label className="form-row">
            <span>
              Final recommendation
              <RequiredStar />
            </span>
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
          <div className="review-editor-callout">
            Your interview evaluation will inform the lead reviewer&apos;s final recommendation.
            <input type="hidden" name="recommendation" value="" />
          </div>
        )}
      </section>

      <section className="review-editor-panel">
        <div>
          <h2>Interview Categories</h2>
          <p>Use the same category language from the application review so interview signals stack naturally.</p>
        </div>

        {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
          const current = categories.find((entry) => entry.category === category.key)!;
          return (
            <div key={category.key} className="review-category-card">
              <div>
                <div className="review-category-title">
                  {category.label}
                  <RequiredStar />
                </div>
                <div className="review-category-description">{category.description}</div>
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

              <label className="form-row">
                <span>
                  Internal note
                  <RequiredStar />
                </span>
                <textarea
                  className="input"
                  rows={2}
                  value={current.notes}
                  disabled={!canEdit}
                  aria-required={canEdit}
                  onChange={(event) =>
                    updateCategoryNotes(category.key, event.target.value)
                  }
                  placeholder="Required category-specific note..."
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="review-editor-panel">
        <label className="form-row">
          Final interview summary
          <textarea
            className="input"
            name="summary"
            rows={4}
            value={summary}
            disabled={!canEdit}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What matters most after the full interview?"
          />
        </label>

        {showRevisionRequirements ? (
          <>
            <div className="review-editor-warning">
              Keep required revisions specific. This recommendation does not approve the candidate yet.
            </div>
            <label className="form-row">
              <span>
                Required support notes
                <RequiredStar />
              </span>
              <textarea
                className="input"
                name="revisionRequirements"
                rows={3}
                value={revisionRequirements}
                disabled={!canEdit}
                onChange={(event) => setRevisionRequirements(event.target.value)}
                placeholder="List the concrete coaching, prep, or revisions required during onboarding."
              />
            </label>
          </>
        ) : (
          <input type="hidden" name="revisionRequirements" value={revisionRequirements} />
        )}

        {showApplicantMessage ? (
          <label className="form-row">
            <span>
              Applicant-facing rejection message
              <RequiredStar />
            </span>
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
      </section>

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
        <button className="button" type="submit" name="intent" value="submit" disabled={!canEdit}>
          Submit Interview Review
        </button>
      </div>
    </form>
  );
}
