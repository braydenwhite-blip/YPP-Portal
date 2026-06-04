"use client";

/**
 * Structured, JSON-free editor for a beat's `config`. Renders kind-specific
 * form fields so a non-technical admin can edit reflection prompts, sort-order
 * steps, fill-in-the-blank answers, and matching pairs — including feedback
 * copy — without ever touching JSON.
 *
 * Controlled component: owns no persistence. The parent (`BeatEditorModal`)
 * holds the `BeatConfigForm` model in state, passes it down, and receives
 * changes via `onChange`. On save the parent converts the model back to a
 * config object with `formModelToConfig()`.
 */

import { useId } from "react";

import {
  type BeatConfigForm,
  type FeedbackForm,
  type FillInBlankForm,
  type MatchPairsForm,
  type ReflectionForm,
  type SortOrderForm,
  STRUCTURED_KIND_LIMITS,
} from "@/lib/journey-editor/beat-config-forms";

interface BeatConfigFormProps {
  form: BeatConfigForm;
  onChange: (next: BeatConfigForm) => void;
}

let rowCounter = 0;
function freshId(prefix: string): string {
  rowCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${rowCounter}`;
}

export function BeatConfigFormFields({ form, onChange }: BeatConfigFormProps) {
  switch (form.kind) {
    case "REFLECTION":
      return <ReflectionFields form={form} onChange={onChange} />;
    case "SORT_ORDER":
      return <SortOrderFields form={form} onChange={onChange} />;
    case "FILL_IN_BLANK":
      return <FillInBlankFields form={form} onChange={onChange} />;
    case "MATCH_PAIRS":
      return <MatchPairsFields form={form} onChange={onChange} />;
  }
}

// ----------------------------------------------------------------------------
// Shared feedback editor
// ----------------------------------------------------------------------------

function FeedbackFields(props: {
  legend: string;
  hint?: string;
  value: FeedbackForm;
  onChange: (next: FeedbackForm) => void;
}) {
  return (
    <fieldset className="beat-config-feedback">
      <legend>{props.legend}</legend>
      {props.hint ? <p className="muted beat-config-hint">{props.hint}</p> : null}
      <label className="form-row">
        <span>Headline</span>
        <input
          value={props.value.headline}
          onChange={(e) => props.onChange({ ...props.value, headline: e.target.value })}
          placeholder="Nice work"
        />
      </label>
      <label className="form-row">
        <span>Message</span>
        <textarea
          rows={2}
          value={props.value.body}
          onChange={(e) => props.onChange({ ...props.value, body: e.target.value })}
          placeholder="Explain why this is the right answer."
        />
      </label>
    </fieldset>
  );
}

// ----------------------------------------------------------------------------
// REFLECTION
// ----------------------------------------------------------------------------

function ReflectionFields({
  form,
  onChange,
}: {
  form: ReflectionForm;
  onChange: (next: BeatConfigForm) => void;
}) {
  return (
    <div className="beat-config">
      <label className="form-row">
        <span>Reflection prompt</span>
        <textarea
          rows={3}
          value={form.prompt}
          onChange={(e) => onChange({ ...form, prompt: e.target.value })}
          placeholder="What will you try in your next session?"
          required
        />
      </label>
      <div className="beat-config-inline">
        <label className="form-row">
          <span>Minimum length</span>
          <input
            type="number"
            min={1}
            value={form.minLength}
            onChange={(e) => onChange({ ...form, minLength: Number(e.target.value) })}
          />
        </label>
        <label className="form-row">
          <span>Maximum length</span>
          <input
            type="number"
            min={1}
            value={form.maxLength}
            onChange={(e) => onChange({ ...form, maxLength: Number(e.target.value) })}
          />
        </label>
      </div>
      <FeedbackFields
        legend="Acknowledgement shown after submitting"
        hint="Reflections aren't graded — this message thanks the learner."
        value={form.correct}
        onChange={(correct) => onChange({ ...form, correct })}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// SORT_ORDER
// ----------------------------------------------------------------------------

function SortOrderFields({
  form,
  onChange,
}: {
  form: SortOrderForm;
  onChange: (next: BeatConfigForm) => void;
}) {
  const limits = STRUCTURED_KIND_LIMITS.SORT_ORDER;
  const canRemove = form.items.length > (limits.minItems ?? 0);
  const canAdd = form.items.length < (limits.maxItems ?? Infinity);

  function update(items: SortOrderForm["items"]) {
    onChange({ ...form, items });
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...form.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">
        List the steps in their <strong>correct</strong> order. Learners see them shuffled and
        drag them back into this order.
      </p>
      <ol className="beat-config-list">
        {form.items.map((item, idx) => (
          <li key={item.id} className="beat-config-row">
            <span className="beat-config-index">{idx + 1}</span>
            <input
              aria-label={`Step ${idx + 1}`}
              value={item.label}
              onChange={(e) => {
                const next = [...form.items];
                next[idx] = { ...item, label: e.target.value };
                update(next);
              }}
              placeholder="Describe this step"
            />
            <div className="beat-config-row-actions">
              <button type="button" className="btn btn-sm" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">↑</button>
              <button type="button" className="btn btn-sm" onClick={() => move(idx, 1)} disabled={idx === form.items.length - 1} aria-label="Move down">↓</button>
              <button
                type="button"
                className="btn btn-danger-ghost btn-sm"
                onClick={() => update(form.items.filter((_, i) => i !== idx))}
                disabled={!canRemove}
                aria-label="Remove step"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => update([...form.items, { id: freshId("item"), label: "" }])}
        disabled={!canAdd}
      >
        + Add step
      </button>
      {!canAdd ? <p className="muted">Maximum {limits.maxItems} steps.</p> : null}
      {!canRemove ? <p className="muted">At least {limits.minItems} steps are required.</p> : null}
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
      <label className="beat-config-checkbox">
        <input
          type="checkbox"
          checked={form.partialCredit}
          onChange={(e) => onChange({ ...form, partialCredit: e.target.checked })}
        />
        <span>Give partial credit for partially-correct orderings</span>
      </label>
    </div>
  );
}

// ----------------------------------------------------------------------------
// FILL_IN_BLANK
// ----------------------------------------------------------------------------

function FillInBlankFields({
  form,
  onChange,
}: {
  form: FillInBlankForm;
  onChange: (next: BeatConfigForm) => void;
}) {
  const limits = STRUCTURED_KIND_LIMITS.FILL_IN_BLANK;
  const canRemove = form.acceptedAnswers.length > (limits.minAnswers ?? 0);

  function updateAnswers(acceptedAnswers: string[]) {
    onChange({ ...form, acceptedAnswers });
  }

  return (
    <div className="beat-config">
      <label className="form-row">
        <span>Prompt</span>
        <textarea
          rows={2}
          value={form.prompt}
          onChange={(e) => onChange({ ...form, prompt: e.target.value })}
          placeholder="The most important first move in any session is to ___."
          required
        />
      </label>
      <fieldset className="beat-config-feedback">
        <legend>Accepted answers</legend>
        <p className="muted beat-config-hint">Any of these (case-insensitive unless set below) counts as correct.</p>
        {form.acceptedAnswers.map((answer, idx) => (
          <div key={idx} className="beat-config-row">
            <input
              aria-label={`Accepted answer ${idx + 1}`}
              value={answer}
              onChange={(e) => {
                const next = [...form.acceptedAnswers];
                next[idx] = e.target.value;
                updateAnswers(next);
              }}
              placeholder="Acceptable answer"
            />
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => updateAnswers(form.acceptedAnswers.filter((_, i) => i !== idx))}
              disabled={!canRemove}
              aria-label="Remove answer"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => updateAnswers([...form.acceptedAnswers, ""])}>
          + Add accepted answer
        </button>
      </fieldset>
      <label className="beat-config-checkbox">
        <input
          type="checkbox"
          checked={form.caseSensitive}
          onChange={(e) => onChange({ ...form, caseSensitive: e.target.checked })}
        />
        <span>Answers are case-sensitive</span>
      </label>
      <label className="form-row">
        <span>Hint (optional)</span>
        <input
          value={form.hint}
          onChange={(e) => onChange({ ...form, hint: e.target.value })}
          placeholder="Shown if the learner is stuck"
        />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// MATCH_PAIRS
// ----------------------------------------------------------------------------

function MatchPairsFields({
  form,
  onChange,
}: {
  form: MatchPairsForm;
  onChange: (next: BeatConfigForm) => void;
}) {
  const limits = STRUCTURED_KIND_LIMITS.MATCH_PAIRS;
  const canRemove = form.pairs.length > (limits.minItems ?? 0);
  const canAdd = form.pairs.length < (limits.maxItems ?? Infinity);
  const headingId = useId();

  function updatePairs(pairs: MatchPairsForm["pairs"]) {
    onChange({ ...form, pairs });
  }

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint" id={headingId}>
        Enter each matching pair. Learners see the right-hand items shuffled and match them back.
      </p>
      <div className="beat-config-pairs" role="group" aria-labelledby={headingId}>
        {form.pairs.map((pair, idx) => (
          <div key={pair.leftId} className="beat-config-pair-row">
            <input
              aria-label={`Left item ${idx + 1}`}
              value={pair.leftLabel}
              onChange={(e) => {
                const next = [...form.pairs];
                next[idx] = { ...pair, leftLabel: e.target.value };
                updatePairs(next);
              }}
              placeholder="Prompt / term"
            />
            <span className="beat-config-pair-arrow" aria-hidden="true">→</span>
            <input
              aria-label={`Right item ${idx + 1}`}
              value={pair.rightLabel}
              onChange={(e) => {
                const next = [...form.pairs];
                next[idx] = { ...pair, rightLabel: e.target.value };
                updatePairs(next);
              }}
              placeholder="Correct match"
            />
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => updatePairs(form.pairs.filter((_, i) => i !== idx))}
              disabled={!canRemove}
              aria-label="Remove pair"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() =>
          updatePairs([
            ...form.pairs,
            { leftId: freshId("l"), leftLabel: "", rightId: freshId("r"), rightLabel: "" },
          ])
        }
        disabled={!canAdd}
      >
        + Add pair
      </button>
      {!canAdd ? <p className="muted">Maximum {limits.maxItems} pairs.</p> : null}
      {!canRemove ? <p className="muted">At least {limits.minItems} pairs are required.</p> : null}
      <label className="form-row">
        <span>Hint (optional)</span>
        <input
          value={form.hint}
          onChange={(e) => onChange({ ...form, hint: e.target.value })}
          placeholder="Shown if the learner is stuck"
        />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
      <label className="beat-config-checkbox">
        <input
          type="checkbox"
          checked={form.partialCredit}
          onChange={(e) => onChange({ ...form, partialCredit: e.target.checked })}
        />
        <span>Give partial credit for partially-correct matches</span>
      </label>
    </div>
  );
}
