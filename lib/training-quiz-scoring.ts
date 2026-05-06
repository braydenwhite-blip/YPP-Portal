/**
 * Pure server-side helpers for training quiz scoring.
 *
 * Why this lives in its own file:
 *   `submitTrainingQuizAttempt` previously honored a client-supplied `scorePct`
 *   form field, allowing learners to spoof passing a required quiz. The fix is
 *   to compute the score server-side from the submitted answers vs. stored
 *   `correctAnswer` values — never trusting any client-asserted score.
 *
 *   `lib/training-actions.ts` is a `"use server"` module; pulling these
 *   helpers out keeps them callable from unit tests without going through the
 *   server-action boundary.
 */

export type QuizSubmissionErrorCode = "MISSING_ANSWERS" | "MALFORMED_ANSWERS";

export class QuizSubmissionError extends Error {
  constructor(
    public readonly code: QuizSubmissionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "QuizSubmissionError";
  }
}

export type QuizQuestionForScoring = {
  id: string;
  correctAnswer: string;
};

export type QuizAttemptResultRow = {
  questionId: string;
  correctAnswer: string;
  userAnswer: string | null;
  correct: boolean;
};

export type QuizAttemptResult = {
  results: QuizAttemptResultRow[];
  scorePct: number;
};

/**
 * Parse the raw `answers` payload from a quiz submission into a sanitized
 * `Record<questionId, answer>`.
 *
 * Throws `QuizSubmissionError` with a clear `code` for missing or malformed
 * payloads so callers can surface a useful message to the learner.
 */
export function parseQuizAnswers(
  raw: string | null | undefined
): Record<string, string> {
  if (raw == null || raw.trim() === "") {
    throw new QuizSubmissionError(
      "MISSING_ANSWERS",
      "Quiz answers are required to submit this attempt."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QuizSubmissionError(
      "MALFORMED_ANSWERS",
      "Quiz answers payload is not valid JSON."
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new QuizSubmissionError(
      "MALFORMED_ANSWERS",
      "Quiz answers payload must be an object mapping questionId to answer."
    );
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string") {
      throw new QuizSubmissionError(
        "MALFORMED_ANSWERS",
        "Each quiz answer must be a string matching one of the question's options."
      );
    }
    out[key] = value;
  }

  return out;
}

/**
 * Compute a quiz attempt result entirely server-side.
 *
 * The score is derived from `questions[].correctAnswer` vs. the submitted
 * `answers` map — no client-asserted score is ever honored. A missing answer
 * for a given question counts as wrong. Returns the per-question result rows
 * and an integer-rounded `scorePct` in `[0, 100]`.
 */
export function computeQuizAttemptResult(
  questions: QuizQuestionForScoring[],
  answers: Record<string, string>
): QuizAttemptResult {
  if (questions.length === 0) {
    return { results: [], scorePct: 0 };
  }

  const results: QuizAttemptResultRow[] = questions.map((question) => {
    const userAnswer = answers[question.id] ?? null;
    return {
      questionId: question.id,
      correctAnswer: question.correctAnswer,
      userAnswer,
      correct: userAnswer !== null && userAnswer === question.correctAnswer,
    };
  });

  const correctCount = results.filter((row) => row.correct).length;
  const scorePct = Math.round((correctCount / questions.length) * 100);

  return { results, scorePct };
}
