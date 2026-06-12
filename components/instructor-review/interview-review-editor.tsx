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
import { buttonVariants } from "@/components/ui-v2";
import {
  CATEGORY_CARD,
  CATEGORY_DESCRIPTION,
  CATEGORY_TITLE,
  CHECKBOX_ROW,
  EDITOR_CALLOUT,
  EDITOR_NOTICE,
  EDITOR_PANEL,
  EDITOR_WARNING,
  FIELD_INPUT,
  FIELD_LABEL,
  RATING_GRID,
  ratingOptionClass,
} from "./editor-classes";
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
    <span className="ml-0.5 font-bold text-rose-600" aria-hidden="true">
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

/** Status tones (Tailwind) — asked/skipped/untouched for bubbles and pills. */
const STATUS_BUBBLE: Record<string, string> = {
  ASKED: "bg-emerald-50 text-emerald-700",
  SKIPPED: "bg-amber-50 text-amber-700",
  UNTOUCHED: "bg-surface-soft text-ink-muted",
};
function statusBubble(status: QuestionStatus): string {
  return STATUS_BUBBLE[status] ?? STATUS_BUBBLE.UNTOUCHED;
}

const CARD_PANEL =
  "rounded-[10px] border border-line bg-surface shadow-card";

/** Guidance label with its colored leading dot (legacy guidance-label skin). */
function guidanceLabel(tone: "question" | "learn" | "followup" | "note" | "plain"): string {
  const dot =
    tone === "question"
      ? "before:bg-slate-800 text-ink"
      : tone === "learn"
        ? "before:bg-amber-500 text-amber-800"
        : tone === "followup"
          ? "before:bg-blue-600 text-blue-700"
          : tone === "note"
            ? "before:bg-slate-400 text-ink-muted"
            : "before:bg-slate-400/60 text-ink-muted";
  return (
    "inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.06em] " +
    "before:inline-block before:size-1.5 before:rounded-full before:content-[''] " +
    dot
  );
}

const TAG_SELECTED: Record<string, string> = {
  success: "border-2 border-emerald-600 bg-emerald-50 text-emerald-700",
  warning: "border-2 border-amber-600 bg-amber-50 text-amber-700",
  danger: "border-2 border-rose-600 bg-rose-50 text-rose-600",
  info: "border-2 border-blue-600 bg-blue-50 text-blue-600",
};

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
    <div className="flex min-h-full flex-col">
      <form
        ref={formRef}
        action={action}
        onSubmit={handleFormSubmit}
        className={`grid w-full gap-[18px] ${focusMode ? "mx-auto max-w-[920px]" : ""}`}
      >
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="categoriesJson" value={categoryPayload} />
        <input type="hidden" name="questionResponsesJson" value={questionPayload} />

        {!canEdit ? (
          <div
            className="rounded-[12px] border border-emerald-200 bg-emerald-50/70 p-4"
            role="status"
          >
            <div className="flex flex-wrap items-start gap-2.5">
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
          <div
            className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 [&>h3]:m-0 [&>h3]:text-[14px] [&>h3]:font-bold [&>h3]:text-amber-900 [&>p]:m-0 [&>p]:mt-1 [&>p]:text-[12.5px] [&>p]:text-amber-900 [&>ul]:m-0 [&>ul]:mt-1.5 [&>ul]:pl-5 [&>ul]:text-[12.5px] [&>ul]:text-amber-900"
            role="alert"
          >
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

        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[10px] border border-line bg-surface p-[22px] shadow-card [&_h2]:m-0 [&_h2]:mt-1 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:text-ink [&_div>p]:m-0 [&_div>p]:mt-1.5 [&_div>p]:max-w-[620px] [&_div>p]:text-[14px] [&_div>p]:leading-relaxed [&_div>p]:text-ink-muted">
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-brand-600 px-3 py-2 text-[12.5px] font-bold text-white shadow-card hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-50"
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
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12.5px] font-bold tabular-nums ${
                timer.running
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-line bg-surface text-ink-muted hover:bg-surface-soft"
              }`}
              onClick={timer.toggle}
              aria-label={timer.running ? "Pause interview timer" : "Start interview timer"}
              title="Press T"
            >
              <span aria-hidden="true">⏱</span>
              <span>{timer.label}</span>
            </button>
            <button
              type="button"
              className={`inline-flex cursor-pointer items-center rounded-[8px] border px-3 py-2 text-[12.5px] font-bold ${
                focusMode
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-line bg-surface text-ink-muted hover:bg-surface-soft"
              }`}
              onClick={() => setFocusMode((value) => !value)}
              aria-pressed={focusMode}
              title="Press F"
            >
              {focusMode ? "Exit Focus" : "Focus Mode"}
            </button>
            <button
              type="button"
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[8px] border border-line bg-surface text-[13px] font-bold text-ink-muted hover:bg-surface-soft"
              onClick={() => setHelpOpen(true)}
              aria-label="Show keyboard shortcuts"
              title="Press ?"
            >
              ?
            </button>
            <SaveChip status={saveStatus} message={saveMessage} />
          </div>
        </section>

        <section className="rounded-[10px] border border-line bg-surface p-4 shadow-card" aria-label="Scratch notes">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className={FIELD_LABEL}>
                <span style={{ fontWeight: 600 }}>Scratch pad</span>
                <p className="m-0 text-[11.5px] font-normal text-ink-muted">
                  Quick thoughts, quotes, anything you want to remember.
                </p>
                <textarea
                  className={FIELD_INPUT}
                  rows={4}
                  value={scratchPad}
                  onChange={(event) => setScratchPad(event.target.value)}
                  placeholder="Free-form notes that aren't tied to a single question..."
                  disabled={!canEdit}
                />
              </label>
              <label className={FIELD_LABEL}>
                <span style={{ fontWeight: 600 }}>Follow up after the interview</span>
                <p className="m-0 text-[11.5px] font-normal text-ink-muted">
                  Things to circle back on — reference checks, missing answers, prep gaps.
                </p>
                <textarea
                  className={FIELD_INPUT}
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

        <section className="flex flex-wrap items-center gap-x-[18px] gap-y-2 rounded-[10px] border border-line bg-surface px-4 py-3 shadow-card" aria-label="How to use this runner">
          <span className="text-[11px] font-black uppercase tracking-[0.07em] text-ink-muted">How to use</span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
            <span className="size-[11px] shrink-0 rounded-[3px] bg-slate-800" aria-hidden="true" />
            Black — the actual question you should be saying
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
            <span className="size-[11px] shrink-0 rounded-[3px] bg-blue-600" aria-hidden="true" />
            Blue — follow-ups
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
            <span className="size-[11px] shrink-0 rounded-[3px] bg-amber-500" aria-hidden="true" />
            Yellow — what we&apos;re trying to learn
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
            <span className="size-[11px] shrink-0 rounded-[3px] bg-emerald-600" aria-hidden="true" />
            Green — strong answers
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
            <span className="size-[11px] shrink-0 rounded-[3px] bg-rose-600" aria-hidden="true" />
            Red — answers that should make you pause
          </span>
        </section>

      <section
        className={`grid items-start gap-[18px] ${focusMode ? "grid-cols-1" : "lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]"}`}
      >
        <aside
          className={`${CARD_PANEL} sticky top-[60px] grid gap-3.5 p-4 ${focusMode ? "hidden" : ""}`}
          aria-label="Interview progress"
        >
          <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0 [&>div]:rounded-[8px] [&>div]:bg-surface-soft [&>div]:px-2 [&>div]:py-2.5 [&>div]:text-center [&>div>strong]:block [&>div>strong]:text-[16px] [&>div>strong]:font-black [&>div>strong]:text-ink [&>div>span]:text-[11px] [&>div>span]:text-ink-muted">
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

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-semibold text-ink-muted">
            <span className={progress.redFlags > 0 ? "text-rose-600" : ""}>
              {progress.redFlags} red flag{progress.redFlags === 1 ? "" : "s"}
            </span>
            <span className={progress.followUps > 0 ? "text-blue-600" : ""}>
              {progress.followUps} follow-up{progress.followUps === 1 ? "" : "s"}
            </span>
            <span className={progress.incompleteAsked > 0 ? "text-amber-600" : ""}>
              {progress.incompleteAsked} incomplete
            </span>
          </div>

          <div className="grid gap-1 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:text-[12px] [&>div>span]:text-ink-muted [&>div>strong]:font-bold [&>div>strong]:text-ink">
            {Object.entries(progress.sections).map(([section, value]) => (
              <div key={section}>
                <span>{section}</span>
                <strong>
                  {value.asked}/{value.total}
                </strong>
              </div>
            ))}
          </div>

          <div className="grid gap-2.5">
            {groupedQuestionNav.map((group) => (
              <div key={group.topic} className="grid gap-1.5">
                <div className="px-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-ink-muted">{group.topic}</div>
                {group.items.map(({ question, originalIndex, isMustAsk }) => (
                  <button
                    key={question.localId}
                    type="button"
                    className={`grid min-h-[42px] cursor-pointer items-center gap-2 rounded-[8px] border bg-surface p-2 text-left ${
                      isMustAsk
                        ? "grid-cols-[26px_minmax(0,1fr)_auto]"
                        : "grid-cols-[26px_minmax(0,1fr)]"
                    } ${
                      question.localId === activeQuestion?.localId
                        ? "border-teal-600 ring-[3px] ring-teal-600/10"
                        : "border-line hover:bg-surface-soft"
                    }`}
                    onClick={() => setActiveQuestionId(question.localId)}
                  >
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] font-black ${statusBubble(question.status)}`}
                    >
                      {originalIndex + 1}
                    </span>
                    <strong className="truncate text-[12px] font-bold leading-tight text-ink">
                      {question.competency || "Custom"}
                    </strong>
                    {isMustAsk ? (
                      <span
                        className="text-[13px] leading-none text-amber-600"
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
            className="w-full cursor-pointer rounded-[8px] border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-50"
            onClick={addCustomQuestion}
            disabled={!canEdit}
          >
            Add Follow-Up Question
          </button>
        </aside>

        {activeQuestion ? (
          <article
            ref={questionCardRef}
            className={`${CARD_PANEL} grid gap-4 p-5 [&_h3]:m-0 [&_h3]:mt-1 [&_h3]:text-[22px] [&_h3]:font-bold [&_h3]:leading-tight [&_h3]:text-ink ${
              activeBankItem?.isMustAsk ? "border-l-4 border-l-amber-400" : ""
            } ${focusMode ? "border-brand-400 shadow-[0_18px_50px_rgb(59_15_110/0.14)]" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">
                    {activeQuestion.source === "CUSTOM"
                      ? "Custom follow-up"
                      : activeBankItem?.topic ?? "Interview question"}
                  </span>
                  {activeBankItem?.isMustAsk ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800"
                      aria-label="Must-ask question"
                    >
                      <span aria-hidden="true">★</span> Must ask
                    </span>
                  ) : null}
                </div>
                <h3>{activeQuestion.competency || "Live interview question"}</h3>
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black ${statusBubble(activeQuestion.status)}`}>
                {labelFromStatus(activeQuestion.status)}
              </span>
            </div>

            {activeQuestion.source === "CUSTOM" ? (
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <label className={FIELD_LABEL}>
                  Custom question
                  <textarea
                    className={FIELD_INPUT}
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
                <label className={FIELD_LABEL}>
                  Competency
                  <input
                    className={FIELD_INPUT}
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
                <label className={FIELD_LABEL}>
                  Why it was asked
                  <textarea
                    className={FIELD_INPUT}
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
                <div className="grid gap-2">
                  <span className={guidanceLabel("question")}>
                    Main question · say this out loud
                  </span>
                  <p className="m-0 text-[26px] font-extrabold leading-tight text-ink">{activeQuestion.prompt}</p>
                </div>
                {activeBankItem?.whyItMatters ? (
                  <div className="grid gap-1.5">
                    <span className={guidanceLabel("learn")}>
                      What we&apos;re trying to learn
                    </span>
                    <p className="m-0 rounded-r-[8px] border-l-4 border-amber-400 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">{activeBankItem.whyItMatters}</p>
                  </div>
                ) : null}
                {activeBankItem?.interviewerGuidance ? (
                  <div className="grid gap-1.5">
                    <span className={guidanceLabel("note")}>Note for you</span>
                    <p className="m-0 rounded-r-[8px] border-l-4 border-slate-300 bg-surface-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">
                      {activeBankItem.interviewerGuidance}
                    </p>
                  </div>
                ) : null}
              </>
            )}

            <div className="flex flex-wrap gap-2" role="group" aria-label="Question status">
              <button
                type="button"
                className={`min-h-9 cursor-pointer rounded-[8px] border px-3 py-2 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  activeQuestion.status === "ASKED"
                    ? "border-teal-600 bg-teal-50 text-teal-700"
                    : "border-line bg-surface text-ink hover:bg-surface-soft"
                }`}
                disabled={!canEdit}
                onClick={() => setQuestionStatus(activeQuestion.localId, "ASKED")}
              >
                Mark Asked
              </button>
              <button
                type="button"
                className={`min-h-9 cursor-pointer rounded-[8px] border px-3 py-2 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  activeQuestion.status === "SKIPPED"
                    ? "border-amber-600 bg-amber-50 text-amber-700"
                    : "border-line bg-surface text-ink hover:bg-surface-soft"
                }`}
                disabled={!canEdit}
                onClick={() => setQuestionStatus(activeQuestion.localId, "SKIPPED")}
              >
                Mark Skipped
              </button>
            </div>

            {activeBankItem &&
            (asStringArray(activeBankItem.strongSignals).length > 0 ||
              asStringArray(activeBankItem.concernSignals).length > 0) ? (
              <details className="grid gap-1.5">
                <summary className={`${guidanceLabel("plain")} cursor-pointer`}>
                  For you only · don&apos;t read aloud — strong-answer / red-flag cheatsheet
                </summary>
                <div className="mt-2 grid gap-3 md:grid-cols-2 [&>div]:min-w-0 [&>div]:rounded-[8px] [&>div]:border [&>div]:p-3 [&_h4]:m-0 [&_h4]:mb-1.5 [&_h4]:text-[13px] [&_h4]:font-black [&_h4]:text-ink [&_ul]:m-0 [&_ul]:pl-[18px] [&_ul]:text-[13px] [&_ul]:leading-normal [&_ul]:text-ink-muted">
                  <div className="border-emerald-200 bg-emerald-50">
                    <h4>Strong answers</h4>
                    <ul>
                      {asStringArray(activeBankItem.strongSignals).map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-rose-200 bg-rose-50">
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

            <div className="grid gap-1.5">
              <span className={guidanceLabel("followup")}>Follow-ups</span>
              <p className="m-0 text-[11.5px] font-normal text-ink-muted">
                Don&apos;t ask all follow-ups — only ask if the candidate&apos;s original answer
                was vague.
              </p>
              {activeBankItem && asStringArray(activeBankItem.suggestedFollowUps).length > 0 ? (
                <div className="flex flex-wrap gap-2 [&>button]:cursor-pointer [&>button]:rounded-[8px] [&>button]:border [&>button]:border-line [&>button]:bg-surface [&>button]:px-2.5 [&>button]:py-1.5 [&>button]:text-[12px] [&>button]:font-semibold [&>button]:text-ink hover:[&>button]:bg-surface-soft">
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
              <label className={FIELD_LABEL}>
                Follow-up you asked
                <textarea
                  className={FIELD_INPUT}
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

            <label className={FIELD_LABEL}>
              <span>
                Notes
                {activeQuestion.status === "ASKED" ? <RequiredStar /> : null}
              </span>
              <p className="m-0 text-[11.5px] font-normal text-ink-muted">
                Take real notes that can be helpful for others.
              </p>
              <textarea
                className={`w-full rounded-[8px] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400 disabled:opacity-60 ${focusMode ? "min-h-[220px]" : "min-h-[120px]"}`}
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

            <div className="grid gap-2 [&>h4]:m-0 [&>h4]:text-[13px] [&>h4]:font-black [&>h4]:text-ink [&>div]:flex [&>div]:flex-wrap [&>div]:gap-2">
              <h4>Answer Tags</h4>
              <div>
                {TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    className={`cursor-pointer rounded-[8px] px-2.5 py-1.5 text-[12px] font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                      activeQuestion.tags.includes(tag.value)
                        ? TAG_SELECTED[tag.tone] ?? TAG_SELECTED.info
                        : "border border-line bg-surface text-ink-muted hover:bg-surface-soft"
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
                className="cursor-pointer self-start rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canEdit}
                onClick={() => removeCustomQuestion(activeQuestion.localId)}
              >
                Remove Custom Question
              </button>
            ) : null}
          </article>
        ) : (
          <div className={EDITOR_NOTICE}>
            <p>No interview questions are available yet.</p>
          </div>
        )}
      </section>

      <section className={EDITOR_PANEL}>
        <div>
          <h2>
            Overall Interview Evaluation
            <RequiredStar />
          </h2>
          <p>Your per-question and per-category notes roll up into this final interview judgment.</p>
        </div>

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
                <div>{option.label}</div>
                <span>{option.description}</span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="overallRating" value={overallRating} />

        {showRecommendation ? (
          <div className={FIELD_LABEL} role="group" aria-labelledby="iv-rec-label">
            <span id="iv-rec-label">
              Final recommendation
              <RequiredStar />
            </span>
            <input type="hidden" name="recommendation" value={recommendation} />
            <div className="grid gap-2 sm:grid-cols-2">
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
                    className={`flex cursor-pointer flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected ? "border-current shadow-card" : "border-line bg-surface hover:bg-surface-soft"
                    }`}
                    style={
                      (selected
                        ? { color: tone.color, background: tone.bg }
                        : { color: tone.color }) as CSSProperties
                    }
                  >
                    <span className="text-[13px] font-black">{option.label}</span>
                    <span className="text-[11.5px] text-ink-muted">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={EDITOR_CALLOUT}>
            Your interview evaluation will inform the lead reviewer&apos;s final recommendation.
            <input type="hidden" name="recommendation" value="" />
          </div>
        )}
      </section>

      <section className={EDITOR_PANEL}>
        <div>
          <h2>Interview Categories</h2>
          <p>Use the same category language from the application review so interview signals stack naturally.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="status" aria-label="Category rating recap">
          <span className="text-[11px] font-black uppercase tracking-[0.06em] text-ink-muted">Coverage</span>
          {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
            const current = categories.find((entry) => entry.category === category.key);
            const ratingOption = current?.rating
              ? PROGRESS_RATING_OPTIONS.find((o) => o.value === current.rating)
              : null;
            return (
              <span
                key={category.key}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  ratingOption ? "border-current" : "border-dashed border-line text-ink-muted"
                }`}
                style={
                  ratingOption
                    ? ({ color: ratingOption.color, background: ratingOption.bg } as CSSProperties)
                    : undefined
                }
                title={ratingOption ? `${category.label}: ${ratingOption.shortLabel}` : `${category.label}: not yet rated`}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {category.label}
              </span>
            );
          })}
        </div>

        {INSTRUCTOR_REVIEW_CATEGORIES.map((category) => {
          const current = categories.find((entry) => entry.category === category.key)!;
          return (
            <div key={category.key} className={CATEGORY_CARD}>
              <div>
                <div className={CATEGORY_TITLE}>
                  {category.label}
                  <RequiredStar />
                </div>
                <div className={CATEGORY_DESCRIPTION}>{category.description}</div>
              </div>

              <div className={RATING_GRID}>
                {PROGRESS_RATING_OPTIONS.map((option) => {
                  const selected = current.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateCategoryRating(category.key, option.value)}
                      className={ratingOptionClass(selected)}
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

              <label className={FIELD_LABEL}>
                <span>
                  Internal note
                  <RequiredStar />
                </span>
                <textarea
                  className={FIELD_INPUT}
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

      <section className={EDITOR_PANEL}>
        {showRevisionRequirements ? (
          <>
            <div className={EDITOR_WARNING}>
              Keep required revisions specific. This recommendation does not approve the candidate yet.
            </div>
            <label className={FIELD_LABEL}>
              <span>
                Required support notes
                <RequiredStar />
              </span>
              <textarea
                className={FIELD_INPUT}
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
          <label className={FIELD_LABEL}>
            <span>
              Applicant-facing rejection message
              <RequiredStar />
            </span>
            <textarea
              className={FIELD_INPUT}
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
      </section>

        <SubmitDockShell
          status={
            <>
              <SaveChip status={saveStatus} message={saveMessage} />
              {missingFields.length > 0 ? (
                <span className="text-[12.5px] font-semibold text-amber-700">
                  {missingFields.length} required {missingFields.length === 1 ? "field" : "fields"} left
                </span>
              ) : (
                <span className="text-[12.5px] font-bold text-emerald-700">Ready to submit</span>
              )}
            </>
          }
          actions={
            <>
              <button
                className={buttonVariants({ variant: "secondary", size: "md" })}
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
                className={buttonVariants({ variant: "primary", size: "md" })}
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
