"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS,
  INSTRUCTOR_REVIEW_CATEGORIES,
  PROGRESS_RATING_OPTIONS,
  type InstructorInterviewRecommendationValue,
  type InstructorReviewCategoryValue,
  type ProgressRatingValue,
} from "@/lib/instructor-review-config";
import { StatusBadge } from "@/components/interviews/ui";
import { KeyboardHelp } from "@/components/instructor-review/live/KeyboardHelp";
import { SaveChip } from "@/components/instructor-review/live/SaveChip";
import { SubmitDockShell } from "@/components/instructor-review/live/SubmitDock";
import {
  useKeyboardShortcuts,
  type Shortcut,
} from "@/components/instructor-review/live/use-keyboard-shortcuts";
import { useInterviewTimer } from "@/components/instructor-review/live/use-interview-timer";

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
  isMustAsk: boolean;
};

type LiveDraftInput = {
  applicationId: string;
  categoriesJson: string;
  questionResponsesJson: string;
  overallRating: string | null;
  recommendation: string | null;
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

const RECOMMENDATION_TONES: Record<
  InstructorInterviewRecommendationValue,
  { color: string; bg: string }
> = {
  ACCEPT: { color: "#166534", bg: "#dcfce7" },
  ACCEPT_WITH_SUPPORT: { color: "#1e40af", bg: "#dbeafe" },
  HOLD: { color: "#92400e", bg: "#fef3c7" },
  REJECT: { color: "#991b1b", bg: "#fee2e2" },
};

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
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scratchPad, setScratchPad] = useState("");
  const [followUpsPad, setFollowUpsPad] = useState("");
  const [notepadOpen, setNotepadOpen] = useState(true);
  const timer = useInterviewTimer(false);
  const mountedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const questionCardRef = useRef<HTMLElement>(null);
  const initialQuestionRef = useRef<string | null>(null);

  const scratchPadStorageKey = `iv-runner:${applicationId}:scratch`;
  const followUpsStorageKey = `iv-runner:${applicationId}:followups`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedScratch = window.localStorage.getItem(scratchPadStorageKey);
      if (savedScratch !== null) setScratchPad(savedScratch);
      const savedFollowUps = window.localStorage.getItem(followUpsStorageKey);
      if (savedFollowUps !== null) setFollowUpsPad(savedFollowUps);
    } catch {
      // localStorage can throw in private-browsing modes — silently ignore.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(scratchPadStorageKey, scratchPad);
    } catch {
      // ignore
    }
  }, [scratchPad, scratchPadStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(followUpsStorageKey, followUpsPad);
    } catch {
      // ignore
    }
  }, [followUpsPad, followUpsStorageKey]);

  useEffect(() => {
    if (initialQuestionRef.current === null) {
      initialQuestionRef.current = activeQuestionId;
      return;
    }
    if (initialQuestionRef.current === activeQuestionId) return;
    initialQuestionRef.current = activeQuestionId;
    const node = questionCardRef.current;
    if (!node || typeof node.scrollIntoView !== "function") return;
    const prefersReducedMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    node.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [activeQuestionId]);

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
    ]
  );
  const livePayloadRef = useRef(livePayload);

  const activeQuestion =
    questions.find((question) => question.localId === activeQuestionId) ?? questions[0] ?? null;
  const activeBankItem = activeQuestion?.questionBankId
    ? questionBank.find((question) => question.id === activeQuestion.questionBankId)
    : null;

  const questionBankById = useMemo(
    () => new Map(questionBank.map((bank) => [bank.id, bank])),
    [questionBank]
  );

  const groupedQuestionNav = useMemo(() => {
    const groups: Array<{
      topic: string;
      items: Array<{ question: QuestionState; originalIndex: number; isMustAsk: boolean }>;
    }> = [];
    const groupIndexByTopic = new Map<string, number>();

    questions.forEach((question, originalIndex) => {
      const bankItem = question.questionBankId ? questionBankById.get(question.questionBankId) : null;
      const topic =
        question.source === "CUSTOM" ? "Custom follow-ups" : bankItem?.topic ?? "Interview question";
      let index = groupIndexByTopic.get(topic);
      if (index === undefined) {
        index = groups.length;
        groupIndexByTopic.set(topic, index);
        groups.push({ topic, items: [] });
      }
      groups[index].items.push({
        question,
        originalIndex,
        isMustAsk: bankItem?.isMustAsk ?? false,
      });
    });

    return groups;
  }, [questions, questionBankById]);

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
        const bankItem = question.questionBankId
          ? questionBankById.get(question.questionBankId)
          : null;
        const key =
          question.source === "CUSTOM"
            ? "Custom follow-ups"
            : bankItem?.topic ?? "Interview";
        const entry = acc[key] ?? { total: 0, asked: 0 };
        entry.total += 1;
        if (question.status === "ASKED") entry.asked += 1;
        acc[key] = entry;
        return acc;
      },
      {}
    );
    return { asked, skipped, untouched, redFlags, followUps, incompleteAsked, sections };
  }, [questionBankById, questions]);

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

  const jumpTo = useCallback(
    (direction: "next" | "prev" | "next-unanswered") => {
      if (questions.length === 0) return;
      const currentIndex = questions.findIndex(
        (question) => question.localId === activeQuestionId
      );
      if (direction === "next") {
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, questions.length - 1);
        setActiveQuestionId(questions[nextIndex].localId);
        return;
      }
      if (direction === "prev") {
        const prevIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
        setActiveQuestionId(questions[prevIndex].localId);
        return;
      }
      const startSearch = currentIndex < 0 ? 0 : currentIndex + 1;
      let target = questions
        .slice(startSearch)
        .find((question) => question.status === "UNTOUCHED");
      if (!target) {
        target = questions.find((question) => question.status === "UNTOUCHED");
      }
      if (target) setActiveQuestionId(target.localId);
    },
    [activeQuestionId, questions]
  );

  const nextUnansweredCount = useMemo(
    () => questions.filter((question) => question.status === "UNTOUCHED").length,
    [questions]
  );

  const submitForm = useCallback((intent: "save" | "submit") => {
    const form = formRef.current;
    if (!form) return;
    const button = document.createElement("button");
    button.type = "submit";
    button.name = "intent";
    button.value = intent;
    button.style.display = "none";
    form.appendChild(button);
    button.click();
    form.removeChild(button);
  }, []);

  const shortcuts = useMemo<Shortcut[]>(() => {
    if (!canEdit) {
      return [
        { key: "?", handler: () => setHelpOpen((value) => !value) },
      ];
    }
    return [
      { key: "?", handler: () => setHelpOpen((value) => !value) },
      { key: "j", handler: () => jumpTo("next") },
      { key: "k", handler: () => jumpTo("prev") },
      { key: "n", handler: () => jumpTo("next-unanswered") },
      {
        key: "a",
        handler: () => {
          if (activeQuestion) setQuestionStatus(activeQuestion.localId, "ASKED");
        },
      },
      {
        key: "s",
        handler: () => {
          if (activeQuestion) setQuestionStatus(activeQuestion.localId, "SKIPPED");
        },
      },
      { key: "f", handler: () => setFocusMode((value) => !value) },
      { key: "t", handler: () => timer.toggle() },
      {
        key: "s",
        meta: true,
        allowInTyping: true,
        handler: (event) => {
          event.preventDefault();
          submitForm("save");
        },
      },
      {
        key: "Enter",
        meta: true,
        allowInTyping: true,
        handler: (event) => {
          event.preventDefault();
          submitForm("submit");
        },
      },
    ];
  }, [activeQuestion, canEdit, jumpTo, submitForm, timer]);

  useKeyboardShortcuts(shortcuts);

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
    <div className={`iv-live-shell${focusMode ? " is-focus-mode" : ""}`}>
      <form
        ref={formRef}
        action={action}
        onSubmit={handleFormSubmit}
        className={`live-interview-workspace iv-live-content${focusMode ? " is-focus-mode" : ""}`}
        style={{ padding: 0, maxWidth: "none" }}
      >
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="categoriesJson" value={categoryPayload} />
        <input type="hidden" name="questionResponsesJson" value={questionPayload} />

        {!canEdit ? (
          <div
            className="iv-card iv-card-tone-success iv-card-body iv-locked-notice"
            role="status"
          >
            <div className="iv-locked-notice-row">
              <StatusBadge tone="completed">Submitted</StatusBadge>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  Review locked &mdash; read-only view
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  Your submitted scorecard, notes, and recommendation are below for reference. An
                  admin can unlock this for edits if anything needs to change.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {missingFields.length > 0 ? (
          <div className="review-editor-missing iv-validation-summary" role="alert">
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
            <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">During-interview workflow</span>
            <h2>Live Question Runner</h2>
            <p>
              Move through questions, capture notes while answers are fresh, tag signals, and save as you go.
            </p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="iv-live-jump-button"
              onClick={() => jumpTo("next-unanswered")}
              disabled={!canEdit || nextUnansweredCount === 0}
              aria-label="Jump to next unanswered question"
              title="Press N"
            >
              Next unanswered
              {nextUnansweredCount > 0 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 20,
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.25)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {nextUnansweredCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`iv-timer-chip${timer.running ? " is-running" : ""}`}
              onClick={timer.toggle}
              aria-label={timer.running ? "Pause interview timer" : "Start interview timer"}
              title="Press T"
              style={{ cursor: "pointer", border: "1px solid var(--iv-border)" }}
            >
              <span aria-hidden="true">⏱</span>
              <span>{timer.label}</span>
            </button>
            <button
              type="button"
              className={`iv-focus-mode-button${focusMode ? " is-active" : ""}`}
              onClick={() => setFocusMode((value) => !value)}
              aria-pressed={focusMode}
              title="Press F"
            >
              {focusMode ? "Exit Focus" : "Focus Mode"}
            </button>
            <button
              type="button"
              className="iv-live-help-button"
              onClick={() => setHelpOpen(true)}
              aria-label="Show keyboard shortcuts"
              title="Press ?"
            >
              ?
            </button>
            <SaveChip status={saveStatus} message={saveMessage} />
          </div>
        </section>

        <section className="live-notepad" aria-label="Scratch notes">
          <div className="live-notepad-header">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">Always-on notes</span>
              <h3 style={{ margin: "2px 0 0" }}>Scratch pad &amp; follow-ups</h3>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--muted)",
                  maxWidth: 640,
                }}
              >
                Free-form notes that stay visible no matter which question you&apos;re on.
                Saved to this browser only — copy anything important into the per-question
                notes or category notes before you submit.
              </p>
            </div>
            <button
              type="button"
              className="button outline small"
              onClick={() => setNotepadOpen((open) => !open)}
              aria-expanded={notepadOpen}
            >
              {notepadOpen ? "Hide" : "Show"} notepad
            </button>
          </div>
          {notepadOpen ? (
            <div className="live-notepad-grid">
              <label className="form-row">
                <span style={{ fontWeight: 600 }}>Scratch pad</span>
                <p className="live-field-hint">
                  Quick thoughts, quotes, anything you want to remember.
                </p>
                <textarea
                  className="input"
                  rows={4}
                  value={scratchPad}
                  onChange={(event) => setScratchPad(event.target.value)}
                  placeholder="Free-form notes that aren't tied to a single question..."
                  disabled={!canEdit}
                />
              </label>
              <label className="form-row">
                <span style={{ fontWeight: 600 }}>Follow up after the interview</span>
                <p className="live-field-hint">
                  Things to circle back on — reference checks, missing answers, prep gaps.
                </p>
                <textarea
                  className="input"
                  rows={4}
                  value={followUpsPad}
                  onChange={(event) => setFollowUpsPad(event.target.value)}
                  placeholder="• Ask their reference about classroom management&#10;• Confirm summer availability"
                  disabled={!canEdit}
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="live-legend" aria-label="How to use this runner">
          <span className="live-legend-title">How to use</span>
          <span className="live-legend-item">
            <span className="live-legend-dot dot-question" aria-hidden="true" />
            Black — the actual question you should be saying
          </span>
          <span className="live-legend-item">
            <span className="live-legend-dot dot-followup" aria-hidden="true" />
            Blue — follow-ups
          </span>
          <span className="live-legend-item">
            <span className="live-legend-dot dot-learn" aria-hidden="true" />
            Yellow — what we&apos;re trying to learn
          </span>
          <span className="live-legend-item">
            <span className="live-legend-dot dot-strong" aria-hidden="true" />
            Green — strong answers
          </span>
          <span className="live-legend-item">
            <span className="live-legend-dot dot-flag" aria-hidden="true" />
            Red — answers that should make you pause
          </span>
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
            {groupedQuestionNav.map((group) => (
              <div key={group.topic} className="live-question-nav-group">
                <div className="live-question-nav-section-label">{group.topic}</div>
                {group.items.map(({ question, originalIndex, isMustAsk }) => (
                  <button
                    key={question.localId}
                    type="button"
                    className={`live-question-nav-item ${statusClass(question.status)}${
                      question.localId === activeQuestion?.localId ? " is-active" : ""
                    }${isMustAsk ? " has-star" : ""}`}
                    onClick={() => setActiveQuestionId(question.localId)}
                  >
                    <span>{originalIndex + 1}</span>
                    <strong>{question.competency || "Custom"}</strong>
                    {isMustAsk ? (
                      <span
                        className="live-question-nav-item-star"
                        aria-label="Must-ask question"
                        title="Must ask"
                      >
                        ★
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
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
          <article
            ref={questionCardRef}
            className={`live-question-card ${statusClass(activeQuestion.status)}${
              activeBankItem?.isMustAsk ? " is-must-ask" : ""
            }`}
          >
            <div className="live-question-card-header">
              <div>
                <div className="live-question-card-header-meta">
                  <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">
                    {activeQuestion.source === "CUSTOM"
                      ? "Custom follow-up"
                      : activeBankItem?.topic ?? "Interview question"}
                  </span>
                  {activeBankItem?.isMustAsk ? (
                    <span className="live-must-ask-badge" aria-label="Must-ask question">
                      <span aria-hidden="true">★</span> Must ask
                    </span>
                  ) : null}
                </div>
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
                <div className="live-question-prompt-block">
                  <span className="live-guidance-label is-question">
                    Main question · say this out loud
                  </span>
                  <p className="live-question-text">{activeQuestion.prompt}</p>
                </div>
                {activeBankItem?.whyItMatters ? (
                  <div className="live-trying-to-learn">
                    <span className="live-guidance-label is-learn">
                      What we&apos;re trying to learn
                    </span>
                    <p className="live-guidance-callout is-learn">{activeBankItem.whyItMatters}</p>
                  </div>
                ) : null}
                {activeBankItem?.interviewerGuidance ? (
                  <div className="live-trying-to-learn">
                    <span className="live-guidance-label is-note">Note for you</span>
                    <p className="live-guidance-callout is-note">
                      {activeBankItem.interviewerGuidance}
                    </p>
                  </div>
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

            {activeBankItem &&
            (asStringArray(activeBankItem.strongSignals).length > 0 ||
              asStringArray(activeBankItem.concernSignals).length > 0) ? (
              <details className="live-guidance-section live-guidance-collapsible">
                <summary className="live-guidance-label" style={{ cursor: "pointer" }}>
                  For you only · don&apos;t read aloud — strong-answer / red-flag cheatsheet
                </summary>
                <div className="live-guidance-grid" style={{ marginTop: 8 }}>
                  <div className="is-strong">
                    <h4>Strong answers</h4>
                    <ul>
                      {asStringArray(activeBankItem.strongSignals).map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="is-flag">
                    <h4>Red flags</h4>
                    <ul>
                      {asStringArray(activeBankItem.concernSignals).map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            ) : null}

            <div className="live-followup-section">
              <span className="live-guidance-label is-followup">Follow-ups</span>
              <p className="live-field-hint">
                Don&apos;t ask all follow-ups — only ask if the candidate&apos;s original answer
                was vague.
              </p>
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
                      + {followUp}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="form-row">
                Follow-up you asked
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
                  placeholder="Record the follow-up you actually asked, if any..."
                />
              </label>
            </div>

            <label className="form-row">
              <span>
                Notes
                {activeQuestion.status === "ASKED" ? <RequiredStar /> : null}
              </span>
              <p className="live-field-hint">
                Take real notes that can be helpful for others.
              </p>
              <textarea
                className="input live-notes-input"
                rows={7}
                value={activeQuestion.notes}
                disabled={!canEdit}
                onChange={(event) => {
                  const value = event.target.value;
                  const shouldAutoMarkAsked =
                    activeQuestion.status === "UNTOUCHED" && value.trim().length > 0;
                  if (shouldAutoMarkAsked) {
                    const now = new Date().toISOString();
                    updateQuestion(activeQuestion.localId, (question) => ({
                      ...question,
                      notes: value,
                      status: "ASKED",
                      askedAt: question.askedAt ?? now,
                    }));
                  } else {
                    updateQuestion(activeQuestion.localId, (question) => ({
                      ...question,
                      notes: value,
                    }));
                  }
                }}
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
          <div className="form-row" role="group" aria-labelledby="iv-rec-label">
            <span id="iv-rec-label">
              Final recommendation
              <RequiredStar />
            </span>
            <input type="hidden" name="recommendation" value={recommendation} />
            <div className="iv-recommendation-grid">
              {INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS.map((option) => {
                const tone = RECOMMENDATION_TONES[option.value];
                const selected = recommendation === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setRecommendation(
                        selected ? "" : (option.value as InstructorInterviewRecommendationValue)
                      )
                    }
                    aria-pressed={selected}
                    className={`iv-recommendation-option${selected ? " is-selected" : ""}`}
                    style={
                      {
                        "--rec-color": tone.color,
                        "--rec-bg": tone.bg,
                      } as CSSProperties
                    }
                  >
                    <span className="iv-recommendation-option-title">{option.label}</span>
                    <span className="iv-recommendation-option-helper">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
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

        <div className="iv-category-recap" role="status" aria-label="Category rating recap">
          <span className="iv-category-recap-label">Coverage</span>
          {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
            const current = categories.find((entry) => entry.category === category.key);
            const ratingOption = current?.rating
              ? PROGRESS_RATING_OPTIONS.find((o) => o.value === current.rating)
              : null;
            return (
              <span
                key={category.key}
                className={`iv-category-recap-chip${ratingOption ? " is-set" : " is-unset"}`}
                style={
                  ratingOption
                    ? ({
                        "--recap-color": ratingOption.color,
                        "--recap-bg": ratingOption.bg,
                      } as CSSProperties)
                    : undefined
                }
                title={ratingOption ? `${category.label}: ${ratingOption.shortLabel}` : `${category.label}: not yet rated`}
              >
                <span className="iv-category-recap-chip-dot" aria-hidden="true" />
                {category.label}
              </span>
            );
          })}
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

        <SubmitDockShell
          status={
            <>
              <SaveChip status={saveStatus} message={saveMessage} />
              {missingFields.length > 0 ? (
                <span className="iv-live-submit-dock-warning">
                  {missingFields.length} required {missingFields.length === 1 ? "field" : "fields"} left
                </span>
              ) : (
                <span className="iv-live-submit-dock-status-strong">Ready to submit</span>
              )}
            </>
          }
          actions={
            <>
              <button
                className="button secondary"
                type="submit"
                name="intent"
                value="save"
                disabled={!canEdit}
                formNoValidate
                aria-label="Save draft"
              >
                Save Draft
              </button>
              <button
                className="button"
                type="submit"
                name="intent"
                value="submit"
                disabled={!canEdit}
                aria-label="Submit interview review"
              >
                Submit Interview Review
              </button>
            </>
          }
        />
      </form>
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
