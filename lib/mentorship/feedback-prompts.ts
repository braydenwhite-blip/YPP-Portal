import { getCurrentCycleMonth } from "@/lib/mentorship-cycle";

export type MentorshipCustomPrompt = {
  id: string;
  question: string;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
};

/** Fixed starter questions for every staff monthly form. */
export const MONTHLY_PRESET_PROMPTS = [
  {
    key: "pastMonth" as const,
    n: "1",
    label: "How would you describe the past month?",
    placeholder: "It felt… / The main theme was…",
    rows: 4,
  },
  {
    key: "yppOverall" as const,
    n: "2",
    label: "How is YPP performing overall from your perspective?",
    placeholder: "From where I sit, YPP is…",
    rows: 4,
  },
  {
    key: "goingWellChallenges" as const,
    n: "3",
    label:
      "What are the biggest things going well as well as challenges we need to address?",
    placeholder: "Going well: … / Challenges: …",
    rows: 5,
  },
  {
    key: "recommendedChanges" as const,
    n: "4",
    label: "What changes if any would you recommend we make?",
    placeholder: "I’d recommend… / No major changes, but…",
    rows: 4,
  },
  {
    key: "hoursPerWeek" as const,
    n: "5",
    label:
      "Approximately how many hours per week did you spend on YPP this month?",
    placeholder: "e.g. 5–8 hours / week",
    rows: 2,
  },
] as const;

export type MonthlyPresetKey = (typeof MONTHLY_PRESET_PROMPTS)[number]["key"];
export type MonthlyPresetAnswers = Partial<Record<MonthlyPresetKey, string>> | null;

export const SUGGESTED_ADDITIONAL_PROMPTS = [
  "On a scale of 1–10, how supported did you feel this month?",
  "How are your classes / responsibilities going?",
  "Is there anything you want support with this month?",
  "What are you most proud of since we last talked?",
  "Anything I should know before we meet?",
] as const;

export type AnswerGuideExample = {
  label: string;
  detail: string;
  /** Optional text inserted when mentee clicks “Use”. Defaults to `detail`. */
  insertText?: string;
};

export type AnswerGuide = {
  kind: "scale" | "text";
  title: string;
  tip: string;
  /** For scale questions: highest number (usually 10). */
  scaleMax?: number;
  examples: AnswerGuideExample[];
};

/**
 * Mentor-authored guidance stored on a question.
 * Omit / null → smart defaults from question text.
 * `hide: true` → no examples panel for the mentee.
 * Any field left blank falls through to the default for that field.
 */
export type StoredAnswerGuide = {
  hide?: boolean;
  /** `auto` (or omitted) keeps scale-vs-text detection from the question text. */
  kind?: "scale" | "text" | "auto";
  title?: string;
  tip?: string;
  scaleMax?: number;
  examples?: AnswerGuideExample[];
};

const SCALE_RE =
  /\b(?:scale\s+of\s+)?1\s*(?:to|-|–|—|\/)\s*10\b|\brate\b.{0,24}\b(?:1|ten)\b|\bfrom\s+1\s+to\s+10\b/i;

const SCALE_EXAMPLES: AnswerGuideExample[] = [
  { label: "1–3", detail: "Really struggling — need help soon." },
  { label: "4–5", detail: "Hard month — some progress, but stuck often." },
  { label: "6–7", detail: "Okay overall — mixed wins and challenges." },
  { label: "8–9", detail: "Strong month — mostly on track." },
  { label: "10", detail: "Excellent — felt clear, supported, and proud." },
];

function textGuideFor(question: string): AnswerGuide {
  const q = question.toLowerCase();
  if (
    q.includes("describe the past month") ||
    q.includes("how was this month") ||
    q.includes("how going")
  ) {
    return {
      kind: "text",
      title: "Example answers",
      tip: "A few honest sentences is enough.",
      examples: [
        {
          label: "Solid",
          detail: "Steady month — busy weeks, but I stayed on top of the main work.",
        },
        {
          label: "Mixed",
          detail: "Up and down. Some clear wins; I also fell behind in a few places.",
        },
        {
          label: "Hard",
          detail: "Tough month. Capacity was tight and priorities kept shifting.",
        },
      ],
    };
  }
  if (q.includes("ypp performing") || q.includes("from your perspective")) {
    return {
      kind: "text",
      title: "Example answers",
      tip: "Speak to overall health, not just your lane.",
      examples: [
        {
          label: "Strong",
          detail: "Momentum feels good — programs are landing and people seem aligned.",
        },
        {
          label: "Uneven",
          detail: "Some areas are thriving; others feel under-resourced or unclear.",
        },
        {
          label: "Concerned",
          detail: "I’m worried about bandwidth and follow-through across teams.",
        },
      ],
    };
  }
  if (
    q.includes("going well") ||
    q.includes("challenges") ||
    q.includes("proud")
  ) {
    return {
      kind: "text",
      title: "Example answers",
      tip: "Name one or two wins and one or two challenges.",
      examples: [
        {
          label: "Both",
          detail:
            "Going well: clearer handoffs. Challenge: too many last-minute asks.",
        },
        {
          label: "Win-heavy",
          detail: "Classes / projects landed well. Challenge: limited mentor time.",
        },
        {
          label: "Challenge-heavy",
          detail: "Wins were small. Biggest challenge is unclear ownership.",
        },
      ],
    };
  }
  if (q.includes("changes") || q.includes("recommend")) {
    return {
      kind: "text",
      title: "Example answers",
      tip: "Concrete and actionable beats vague.",
      examples: [
        {
          label: "Process",
          detail: "Set a clearer weekly priority list so we stop thrashing.",
        },
        {
          label: "Support",
          detail: "Add a short office-hours slot for blockers mid-week.",
        },
        {
          label: "None",
          detail: "No major changes — keep the current cadence.",
        },
      ],
    };
  }
  if (q.includes("hours per week") || q.includes("hours/week")) {
    return {
      kind: "text",
      title: "Example answers",
      tip: "A rough weekly average is fine.",
      examples: [
        { label: "Light", detail: "About 3–4 hours per week." },
        { label: "Typical", detail: "Around 6–8 hours per week." },
        { label: "Heavy", detail: "Closer to 12+ hours most weeks." },
      ],
    };
  }
  if (q.includes("hard") || q.includes("support") || q.includes("stuck")) {
    return {
      kind: "text",
      title: "Example answers",
      tip: "Name the blocker and what would help.",
      examples: [
        {
          label: "Time",
          detail: "I ran out of time after other commitments — shorter weekly goals would help.",
        },
        {
          label: "Clarity",
          detail: "I’m unsure what “done” looks like for this work.",
        },
        {
          label: "Help",
          detail: "I’d like a quick check-in before I start the next piece.",
        },
      ],
    };
  }
  return {
    kind: "text",
    title: "Tips",
    tip: "Be specific. Short answers are fine.",
    examples: [
      {
        label: "Specific",
        detail: "Say what happened, what you tried, and what you need next.",
      },
      {
        label: "Honest",
        detail: "It’s okay if the month was messy — that helps your mentor help you.",
      },
      {
        label: "Forward",
        detail: "End with one thing you want to focus on next.",
      },
    ],
  };
}

/** Side-panel guidance while a mentee answers a monthly feedback question. */
export function getAnswerGuide(questionText: string): AnswerGuide {
  const text = questionText.trim();
  if (SCALE_RE.test(text)) {
    return {
      kind: "scale",
      title: "What the numbers mean",
      tip: "Pick a number, then optionally add a short note.",
      scaleMax: 10,
      examples: SCALE_EXAMPLES,
    };
  }
  return textGuideFor(text);
}

function parseExample(raw: unknown): AnswerGuideExample | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.label !== "string" || typeof r.detail !== "string") return null;
  const label = r.label.trim();
  const detail = r.detail.trim();
  if (!label || !detail) return null;
  const insertText =
    typeof r.insertText === "string" && r.insertText.trim()
      ? r.insertText.trim()
      : undefined;
  return insertText ? { label, detail, insertText } : { label, detail };
}

function parseStoredGuide(raw: unknown): StoredAnswerGuide | null {
  if (raw == null) return null;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const guide: StoredAnswerGuide = {};
  if (r.hide === true) guide.hide = true;
  if (r.kind === "scale" || r.kind === "text" || r.kind === "auto") {
    guide.kind = r.kind;
  }
  if (typeof r.title === "string") guide.title = r.title;
  if (typeof r.tip === "string") guide.tip = r.tip;
  if (typeof r.scaleMax === "number" && r.scaleMax >= 2 && r.scaleMax <= 20) {
    guide.scaleMax = Math.round(r.scaleMax);
  }
  if (Array.isArray(r.examples)) {
    guide.examples = r.examples
      .map(parseExample)
      .filter((e): e is AnswerGuideExample => e !== null);
  }
  return guide;
}

/** Resolve mentee-facing guide: mentor overrides + smart defaults. */
export function resolveAnswerGuide(question: {
  text: string;
  guide?: StoredAnswerGuide | null;
}): AnswerGuide | null {
  const custom = question.guide;
  if (custom?.hide) return null;

  const fallback = getAnswerGuide(question.text);
  if (!custom) return fallback;

  const kind =
    custom.kind === "scale" || custom.kind === "text"
      ? custom.kind
      : fallback.kind;

  const title = custom.title?.trim() || fallback.title;
  const tip = custom.tip?.trim() || fallback.tip;
  const scaleMax =
    kind === "scale" ? (custom.scaleMax ?? fallback.scaleMax ?? 10) : undefined;
  const examples = Array.isArray(custom.examples)
    ? custom.examples
    : fallback.examples;

  if (!title && !tip && examples.length === 0) return null;

  return { kind, title, tip, scaleMax, examples };
}

/** Snapshot defaults into a stored guide so mentors can edit from a starting point. */
export function defaultGuideAsStored(questionText: string): StoredAnswerGuide {
  const g = getAnswerGuide(questionText);
  return {
    kind: g.kind,
    title: g.title,
    tip: g.tip,
    scaleMax: g.scaleMax,
    examples: g.examples.map((e) => ({ ...e })),
  };
}

export type MonthlyFeedbackQuestion = {
  id: string;
  text: string;
  kind: "preset" | "custom";
  answer: string | null;
  /** Mentor-authored examples / tip. Null/undefined → defaults. */
  guide?: StoredAnswerGuide | null;
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

/**
 * Keep DRAFT forms on the latest staff preset set (preserves custom questions).
 * Sent / answered forms are left alone.
 */
export function syncDraftPresetQuestions(
  form: MonthlyFeedbackForm,
): MonthlyFeedbackForm {
  if (form.status !== "DRAFT") return form;
  const expected = MONTHLY_PRESET_PROMPTS.map((p) => p.label);
  const presets = form.questions.filter((q) => q.kind === "preset");
  const customs = form.questions.filter((q) => q.kind !== "preset");
  const current = presets.map((p) => p.text);
  const same =
    current.length === expected.length &&
    current.every((text, i) => text === expected[i]);
  if (same) return form;
  return {
    ...form,
    questions: [...createPresetQuestions(), ...customs],
  };
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
  const guide = parseStoredGuide(r.guide);
  return {
    id: r.id,
    text: r.text,
    kind: r.kind === "preset" ? "preset" : "custom",
    answer: typeof r.answer === "string" ? r.answer : null,
    ...(guide ? { guide } : {}),
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
  if (existing) {
    const synced = syncDraftPresetQuestions(existing);
    if (synced === existing) return { store, current: existing };
    return {
      store: {
        version: 2,
        forms: store.forms.map((f) =>
          f.cycleMonthKey === cycleMonthKey ? synced : f,
        ),
      },
      current: synced,
    };
  }

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
