import {
  InterviewAnswerTag,
  InterviewQuestionRunStatus,
  ProgressStatus,
} from "@prisma/client";

export const INTERVIEW_ANSWER_TAG_OPTIONS = [
  {
    value: "STRONG_ANSWER",
    label: "Strong Answer",
    tone: "success",
  },
  {
    value: "WEAK_ANSWER",
    label: "Weak Answer",
    tone: "warning",
  },
  {
    value: "RED_FLAG",
    label: "Red Flag",
    tone: "danger",
  },
  {
    value: "FOLLOW_UP_NEEDED",
    label: "Follow Up Needed",
    tone: "info",
  },
  {
    value: "GREAT_COMMUNICATOR",
    label: "Great Communicator",
    tone: "success",
  },
  {
    value: "HIGH_POTENTIAL",
    label: "High Potential",
    tone: "success",
  },
  {
    value: "NEEDS_COACHING",
    label: "Needs Coaching",
    tone: "warning",
  },
] as const;

export type InterviewAnswerTagValue =
  (typeof INTERVIEW_ANSWER_TAG_OPTIONS)[number]["value"];

export type InterviewQuestionRunStatusValue =
  keyof typeof InterviewQuestionRunStatus;

export type LiveQuestionResponsePayload = {
  id?: string | null;
  localId?: string | null;
  questionBankId?: string | null;
  source: "DEFAULT" | "CUSTOM";
  status: InterviewQuestionRunStatus;
  prompt: string;
  followUpPrompt?: string | null;
  competency?: string | null;
  whyAsked?: string | null;
  notes?: string | null;
  rating?: ProgressStatus | null;
  tags: InterviewAnswerTag[];
  askedAt?: Date | null;
  skippedAt?: Date | null;
  sortOrder: number;
};

const PROGRESS_STATUS_VALUES = new Set(Object.values(ProgressStatus));
const QUESTION_STATUS_VALUES = new Set(Object.values(InterviewQuestionRunStatus));
const ANSWER_TAG_VALUES = new Set(Object.values(InterviewAnswerTag));

export function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function parseProgressStatus(value: unknown): ProgressStatus | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!PROGRESS_STATUS_VALUES.has(normalized as ProgressStatus)) {
    throw new Error(`Invalid progress rating: ${normalized}`);
  }
  return normalized as ProgressStatus;
}

export function parseQuestionRunStatus(value: unknown): InterviewQuestionRunStatus {
  const normalized = String(value ?? "UNTOUCHED").trim();
  if (!QUESTION_STATUS_VALUES.has(normalized as InterviewQuestionRunStatus)) {
    throw new Error(`Invalid interview question status: ${normalized}`);
  }
  return normalized as InterviewQuestionRunStatus;
}

export function parseAnswerTags(value: unknown): InterviewAnswerTag[] {
  if (!value) return [];
  if (!Array.isArray(value)) {
    throw new Error("Interview answer tags must be an array.");
  }

  const tags: InterviewAnswerTag[] = [];
  for (const entry of value) {
    const normalized = String(entry ?? "").trim();
    if (!normalized) continue;
    if (!ANSWER_TAG_VALUES.has(normalized as InterviewAnswerTag)) {
      throw new Error(`Invalid interview answer tag: ${normalized}`);
    }
    if (!tags.includes(normalized as InterviewAnswerTag)) {
      tags.push(normalized as InterviewAnswerTag);
    }
  }
  return tags;
}

function parseNullableDate(value: unknown): Date | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseInterviewQuestionResponses(raw: string): LiveQuestionResponsePayload[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Interview question responses could not be parsed.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Interview question responses must be an array.");
  }

  return parsed.map((entry, index): LiveQuestionResponsePayload => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each interview question response must be an object.");
    }

    const record = entry as Record<string, unknown>;
    const prompt = normalizeNullableText(String(record.prompt ?? ""));
    const sourceRaw = String(record.source ?? "DEFAULT").trim();
    const source = sourceRaw === "CUSTOM" ? "CUSTOM" : "DEFAULT";
    const status = parseQuestionRunStatus(record.status);
    const sortOrderValue = Number(record.sortOrder ?? index);

    if (!prompt) {
      throw new Error("Every interview question must have a prompt.");
    }

    return {
      id: normalizeNullableText(String(record.id ?? "")),
      localId: normalizeNullableText(String(record.localId ?? "")),
      questionBankId: normalizeNullableText(String(record.questionBankId ?? "")),
      source,
      status,
      prompt,
      followUpPrompt: normalizeNullableText(String(record.followUpPrompt ?? "")),
      competency: normalizeNullableText(String(record.competency ?? "")),
      whyAsked: normalizeNullableText(String(record.whyAsked ?? "")),
      notes: normalizeNullableText(String(record.notes ?? "")),
      rating: parseProgressStatus(record.rating),
      tags: parseAnswerTags(record.tags),
      askedAt: parseNullableDate(record.askedAt),
      skippedAt: parseNullableDate(record.skippedAt),
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : index,
    };
  });
}

export function validateSubmittedQuestionResponses(
  questionResponses: LiveQuestionResponsePayload[]
) {
  if (questionResponses.length === 0) {
    throw new Error("Interview questions are required before submission.");
  }

  for (const question of questionResponses) {
    if (!question.prompt) {
      throw new Error("Every interview question must include a prompt.");
    }
    if (question.status !== "ASKED") continue;
    if (!question.notes) {
      throw new Error("Every asked interview question must include interviewer notes before submission.");
    }
  }
}
