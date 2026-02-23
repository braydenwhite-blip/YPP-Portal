"use client";

import { useState } from "react";

interface QuizOptionBuilderProps {
  options: string[];
  correctAnswer: string;
  onChange: (options: string[], correctAnswer: string) => void;
}

export default function QuizOptionBuilder({ options, correctAnswer, onChange }: QuizOptionBuilderProps) {
  function updateOption(index: number, value: string) {
    const next = options.map((o, i) => (i === index ? value : o));
    // If the updated option was the correct answer, update correctAnswer too
    const nextCorrect = options[index] === correctAnswer ? value : correctAnswer;
    onChange(next, nextCorrect);
  }

  function removeOption(index: number) {
    const next = options.filter((_, i) => i !== index);
    const nextCorrect = options[index] === correctAnswer ? "" : correctAnswer;
    onChange(next, nextCorrect);
  }

  function addOption() {
    onChange([...options, ""], correctAnswer);
  }

  function setCorrect(option: string) {
    onChange(options, option);
  }

  return (
    <div>
      <p className="quiz-option-correct-label">Select the radio button next to the correct answer</p>
      {options.map((opt, i) => (
        <div key={i} className="quiz-option-row">
          <input
            type="radio"
            className="quiz-option-radio"
            name="correctAnswerRadio"
            checked={opt !== "" && opt === correctAnswer}
            onChange={() => setCorrect(opt)}
            aria-label={`Mark option ${i + 1} as correct`}
          />
          <input
            className="input quiz-option-input"
            type="text"
            value={opt}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => updateOption(i, e.target.value)}
            required
          />
          <button
            type="button"
            className="quiz-option-remove"
            onClick={() => removeOption(i)}
            aria-label={`Remove option ${i + 1}`}
            disabled={options.length <= 2}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button small outline"
        onClick={addOption}
        disabled={options.length >= 6}
        style={{ marginTop: 4 }}
      >
        + Add Option
      </button>
      {options.length >= 6 && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>Maximum 6 options</p>
      )}
    </div>
  );
}
