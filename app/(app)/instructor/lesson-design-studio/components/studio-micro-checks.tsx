"use client";

import {
  LESSON_DESIGN_UNDERSTANDING_QUESTIONS,
  scoreUnderstandingChecks,
  UNDERSTANDING_PASS_SCORE_PCT,
  type StudioUnderstandingChecks,
} from "@/lib/curriculum-draft-progress";

interface StudioMicroChecksProps {
  /** Short label above the title (default: Teaching checks). */
  eyebrow?: string;
  title: string;
  description: string;
  questionIds: string[];
  understandingChecks: StudioUnderstandingChecks;
  onAnswer: (questionId: string, answer: string) => void;
  readOnly?: boolean;
}

export function StudioMicroChecks({
  eyebrow = "Teaching checks",
  title,
  description,
  questionIds,
  understandingChecks,
  onAnswer,
  readOnly = false,
}: StudioMicroChecksProps) {
  const questions = LESSON_DESIGN_UNDERSTANDING_QUESTIONS.filter((question) =>
    questionIds.includes(question.id)
  );
  const totalAnswered = questions.filter(
    (question) => understandingChecks.answers[question.id]
  ).length;
  const totalCorrect = questions.filter(
    (question) =>
      understandingChecks.answers[question.id] === question.correctAnswer
  ).length;
  const overallResult = scoreUnderstandingChecks(understandingChecks.answers);

  return (
    <section className="lds-step-card">
      <div className="lds-step-card-header">
        <div>
          <p className="lds-section-eyebrow">{eyebrow}</p>
          <h3 className="lds-section-title">{title}</h3>
          <p className="lds-section-copy">{description}</p>
        </div>
        <div className="lds-micro-check-summary">
          <span>{totalCorrect}/{questions.length} right here</span>
          <strong>
            Overall {overallResult.scorePct}% / {UNDERSTANDING_PASS_SCORE_PCT}% needed
          </strong>
        </div>
      </div>

      <div className="lds-micro-check-grid">
        {questions.map((question) => {
          const answer = understandingChecks.answers[question.id];
          const isCorrect = answer === question.correctAnswer;
          const isAnswered = typeof answer === "string" && answer.length > 0;

          return (
            <article key={question.id} className="lds-micro-check-card">
              <p className="lds-micro-check-question">{question.prompt}</p>
              <div className="lds-micro-check-options">
                {question.options.map((option) => (
                  <label
                    key={option}
                    className={`lds-micro-check-option${
                      answer === option ? " selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answer === option}
                      disabled={readOnly}
                      onChange={() => onAnswer(question.id, option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {isAnswered ? (
                <p
                  className={`lds-micro-check-feedback${
                    isCorrect ? " success" : " warning"
                  }`}
                >
                  {isCorrect
                    ? "Strong teaching move. This answer matches the studio guidance."
                    : question.explanation}
                </p>
              ) : (
                <p className="lds-micro-check-feedback muted">
                  Answer this so your readiness score can build as you go.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p className="lds-micro-check-footnote">
        {totalAnswered === questions.length
          ? "These answers are already being counted toward your final readiness score."
          : `You have answered ${totalAnswered} of ${questions.length} checks in this section so far.`}
      </p>
    </section>
  );
}
