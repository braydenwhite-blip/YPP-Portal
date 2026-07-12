import { getCurrentCycleMonth } from "@/lib/mentorship-cycle";

export type MentorshipCustomPrompt = {
  id: string;
  question: string;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
};

/** Fixed starter questions for a new monthly form. */
export const MONTHLY_PRESET_PROMPTS = [
  {
    key: "howGoing" as const,
    n: "1",
    label: "How was this month?",
    hint: "A few sentences is plenty.",
    placeholder: "It was pretty good / busy / hard because…",
    rows: 4,
  },
  {
    key: "whatGood" as const,
    n: "2",
    label: "What went well?",
    hint: "One win is enough.",
    placeholder: "I finished… / I felt proud of…",
    rows: 3,
  },
  {
    key: "whatHard" as const,
    n: "3",
    label: "What was hard?",
    hint: "Or what do you need help with?",
    placeholder: "I got stuck on… / I wish I had help with…",
    rows: 3,
  },
] as const;

export type MonthlyPresetKey = (typeof MONTHLY_PRESET_PROMPTS)[number]["key"];
export type MonthlyPresetAnswers = Partial<Record<MonthlyPresetKey, string>> | null;

export const SUGGESTED_ADDITIONAL_PROMPTS = [
  "How are your classes / responsibilities going?",
  "Is there anything you want support with this month?",
  "What are you most proud of since we last talked?",
  "Anything I should know before we meet?",
] as const;

export type MonthlyFeedbackQuestion = {
  id: string;
  text: string;
  kind: "preset" | "custom";
  answer: string | null;
};

export type MonthlyFeedbackForm = {
  id: string;
  cycleMonthKey: string;
  cycleLabel: string;
  status: "DRAFT" | "SENT" | "ANSWERED";
  sentAt: string | null;
  answeredAt: string | null;
  questions: MonthlyFeedbackQuestion[];
};

export type MonthlyFeedbackStore = {
  version: 2;
  forms: MonthlyFeedbackForm[];
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPresetQuestions(): MonthlyFeedbackQuestion[] {
  return MONTHLY_PRESET_PROMPTS.map((p) => ({
    id: newId("q"),
    text: p.label,
    kind: "preset" as const,
    answer: null,
  }));
}

export function createMonthlyDraft(
  cycleMonthKey?: string,
  cycleLabel?: string
): MonthlyFeedbackForm {
  const cycle = getCurrentCycleMonth();
  return {
    id: newId("form"),
    cycleMonthKey: cycleMonthKey ?? cycle.cycleMonthKey,
    cycleLabel: cycleLabel ?? cycle.cycleLabel,
    status: "DRAFT",
    sentAt: null,
    answeredAt: null,
    questions: createPresetQuestions(),
  };
}

function parseQuestion(raw: unknown): MonthlyFeedbackQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.text !== "string") return null;
  return {
    id: r.id,
    text: r.text,
    kind: r.kind === "preset" ? "preset" : "custom",
    answer: typeof r.answer === "string" ? r.answer : null,
  };
}

function parseForm(raw: unknown): MonthlyFeedbackForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.cycleMonthKey !== "string" ||
    typeof r.cycleLabel !== "string"
  ) {
    return null;
  }
  const status =
    r.status === "SENT" || r.status === "ANSWERED" || r.status === "DRAFT"
      ? r.status
      : "DRAFT";
  const questions = Array.isArray(r.questions)
    ? r.questions.map(parseQuestion).filter((q): q is MonthlyFeedbackQuestion => q !== null)
    : [];
  return {
    id: r.id,
    cycleMonthKey: r.cycleMonthKey,
    cycleLabel: r.cycleLabel,
    status,
    sentAt: typeof r.sentAt === "string" ? r.sentAt : null,
    answeredAt: typeof r.answeredAt === "string" ? r.answeredAt : null,
    questions,
  };
}

/** Legacy flat custom prompts → fold into a draft for the current month. */
function migrateLegacyPrompts(raw: unknown[]): MonthlyFeedbackStore {
  const draft = createMonthlyDraft();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.question !== "string") continue;
    draft.questions.push({
      id: typeof r.id === "string" ? r.id : newId("q"),
      text: r.question,
      kind: "custom",
      answer: typeof r.answer === "string" ? r.answer : null,
    });
  }
  const allAnswered =
    draft.questions.length > 0 && draft.questions.every((q) => Boolean(q.answer?.trim()));
  if (allAnswered) {
    draft.status = "ANSWERED";
    draft.sentAt = new Date().toISOString();
    draft.answeredAt = new Date().toISOString();
  }
  return { version: 2, forms: [draft] };
}

export function readMonthlyFeedbackStore(raw: unknown): MonthlyFeedbackStore {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.version === 2 && Array.isArray(obj.forms)) {
      return {
        version: 2,
        forms: obj.forms
          .map(parseForm)
          .filter((f): f is MonthlyFeedbackForm => f !== null),
      };
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return migrateLegacyPrompts(raw);
  }
  return { version: 2, forms: [] };
}

export function ensureCurrentMonthForm(
  store: MonthlyFeedbackStore,
  now = new Date()
): { store: MonthlyFeedbackStore; current: MonthlyFeedbackForm } {
  const { cycleMonthKey, cycleLabel } = getCurrentCycleMonth(now);
  const existing = store.forms.find((f) => f.cycleMonthKey === cycleMonthKey);
  if (existing) return { store, current: existing };

  const draft = createMonthlyDraft(cycleMonthKey, cycleLabel);
  return {
    store: { version: 2, forms: [draft, ...store.forms] },
    current: draft,
  };
}

export function pastMonthlyForms(
  store: MonthlyFeedbackStore,
  currentKey: string
): MonthlyFeedbackForm[] {
  return store.forms
    .filter(
      (f) =>
        f.cycleMonthKey !== currentKey &&
        (f.status === "ANSWERED" || f.status === "SENT")
    )
    .sort((a, b) => b.cycleMonthKey.localeCompare(a.cycleMonthKey));
}

/** @deprecated kept for older imports — prefer monthly forms. */
export function readMentorshipCustomPrompts(
  raw: unknown
): MentorshipCustomPrompt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.question !== "string") return null;
      return {
        id: r.id,
        question: r.question,
        answer: typeof r.answer === "string" ? r.answer : null,
        createdAt:
          typeof r.createdAt === "string"
            ? r.createdAt
            : new Date().toISOString(),
        answeredAt: typeof r.answeredAt === "string" ? r.answeredAt : null,
      };
    })
    .filter((p): p is MentorshipCustomPrompt => p !== null);
}
