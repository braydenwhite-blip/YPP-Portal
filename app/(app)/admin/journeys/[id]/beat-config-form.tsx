"use client";

/**
 * Structured, JSON-free editor for a beat's `config`. Renders kind-specific
 * form fields so a non-technical admin can edit every interactive journey beat
 * kind — prompts, options, correct answers, steps, pairs, regions, feedback —
 * without ever touching JSON.
 *
 * Controlled component: owns no persistence. The parent (`BeatEditorModal`)
 * holds the `BeatConfigForm` model in state, passes it down, and receives
 * changes via `onChange`. On save the parent converts the model back to a
 * config object with `formModelToConfig()`.
 */

import { useId } from "react";

import {
  type BeatConfigForm,
  type BranchingScenarioForm,
  type CompareForm,
  type ConceptRevealForm,
  type ContentBlockForm,
  type FeedbackForm,
  type FillInBlankForm,
  type HotspotForm,
  type MatchPairsForm,
  type MessageComposerForm,
  type MultiSelectForm,
  type ReflectionForm,
  type ScenarioChoiceForm,
  type SortOrderForm,
  type SpotTheMistakeForm,
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
    case "CONCEPT_REVEAL":
      return <ConceptRevealFields form={form} onChange={onChange} />;
    case "CONTENT_BLOCK":
      return <ContentBlockFields form={form} onChange={onChange} />;
    case "SCENARIO_CHOICE":
      return <ScenarioChoiceFields form={form} onChange={onChange} />;
    case "MULTI_SELECT":
      return <MultiSelectFields form={form} onChange={onChange} />;
    case "SPOT_THE_MISTAKE":
      return <SpotTheMistakeFields form={form} onChange={onChange} />;
    case "BRANCHING_SCENARIO":
      return <BranchingScenarioFields form={form} onChange={onChange} />;
    case "COMPARE":
      return <CompareFields form={form} onChange={onChange} />;
    case "HOTSPOT":
      return <HotspotFields form={form} onChange={onChange} />;
    case "MESSAGE_COMPOSER":
      return <MessageComposerFields form={form} onChange={onChange} />;
  }
}

// ----------------------------------------------------------------------------
// Shared building blocks
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

/** Up / down / remove controls for a reorderable list row. */
function RowControls(props: {
  index: number;
  count: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="beat-config-row-actions">
      <button type="button" className="btn btn-sm" onClick={() => props.onMove(props.index, -1)} disabled={props.index === 0} aria-label="Move up">↑</button>
      <button type="button" className="btn btn-sm" onClick={() => props.onMove(props.index, 1)} disabled={props.index === props.count - 1} aria-label="Move down">↓</button>
      <button type="button" className="btn btn-danger-ghost btn-sm" onClick={props.onRemove} disabled={!props.canRemove} aria-label="Remove">✕</button>
    </div>
  );
}

function LimitNotes({ canAdd, canRemove, max, min, noun }: {
  canAdd: boolean;
  canRemove: boolean;
  max?: number;
  min?: number;
  noun: string;
}) {
  return (
    <>
      {!canAdd && max ? <p className="muted">Maximum {max} {noun}.</p> : null}
      {!canRemove && min ? <p className="muted">At least {min} {noun} required.</p> : null}
    </>
  );
}

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = [...list];
  const target = index + dir;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ----------------------------------------------------------------------------
// REFLECTION
// ----------------------------------------------------------------------------

function ReflectionFields({ form, onChange }: { form: ReflectionForm; onChange: (n: BeatConfigForm) => void }) {
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
          <input type="number" min={1} value={form.minLength} onChange={(e) => onChange({ ...form, minLength: Number(e.target.value) })} />
        </label>
        <label className="form-row">
          <span>Maximum length</span>
          <input type="number" min={1} value={form.maxLength} onChange={(e) => onChange({ ...form, maxLength: Number(e.target.value) })} />
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

function SortOrderFields({ form, onChange }: { form: SortOrderForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.SORT_ORDER;
  const canRemove = form.items.length > (limits.minItems ?? 0);
  const canAdd = form.items.length < (limits.maxItems ?? Infinity);
  const update = (items: SortOrderForm["items"]) => onChange({ ...form, items });

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">
        List the steps in their <strong>correct</strong> order. Learners see them shuffled and drag them back into this order.
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
            <RowControls index={idx} count={form.items.length} canRemove={canRemove} onMove={(i, d) => update(move(form.items, i, d))} onRemove={() => update(form.items.filter((_, i) => i !== idx))} />
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.items, { id: freshId("item"), label: "" }])} disabled={!canAdd}>+ Add step</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="steps" />
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
      <label className="beat-config-checkbox">
        <input type="checkbox" checked={form.partialCredit} onChange={(e) => onChange({ ...form, partialCredit: e.target.checked })} />
        <span>Give partial credit for partially-correct orderings</span>
      </label>
    </div>
  );
}

// ----------------------------------------------------------------------------
// FILL_IN_BLANK
// ----------------------------------------------------------------------------

function FillInBlankFields({ form, onChange }: { form: FillInBlankForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.FILL_IN_BLANK;
  const canRemove = form.acceptedAnswers.length > (limits.minAnswers ?? 0);
  const updateAnswers = (acceptedAnswers: string[]) => onChange({ ...form, acceptedAnswers });

  return (
    <div className="beat-config">
      <label className="form-row">
        <span>Prompt</span>
        <textarea rows={2} value={form.prompt} onChange={(e) => onChange({ ...form, prompt: e.target.value })} placeholder="The most important first move in any session is to ___." required />
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
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => updateAnswers(form.acceptedAnswers.filter((_, i) => i !== idx))} disabled={!canRemove} aria-label="Remove answer">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => updateAnswers([...form.acceptedAnswers, ""])}>+ Add accepted answer</button>
      </fieldset>
      <label className="beat-config-checkbox">
        <input type="checkbox" checked={form.caseSensitive} onChange={(e) => onChange({ ...form, caseSensitive: e.target.checked })} />
        <span>Answers are case-sensitive</span>
      </label>
      <label className="form-row">
        <span>Hint (optional)</span>
        <input value={form.hint} onChange={(e) => onChange({ ...form, hint: e.target.value })} placeholder="Shown if the learner is stuck" />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// MATCH_PAIRS
// ----------------------------------------------------------------------------

function MatchPairsFields({ form, onChange }: { form: MatchPairsForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.MATCH_PAIRS;
  const canRemove = form.pairs.length > (limits.minItems ?? 0);
  const canAdd = form.pairs.length < (limits.maxItems ?? Infinity);
  const headingId = useId();
  const updatePairs = (pairs: MatchPairsForm["pairs"]) => onChange({ ...form, pairs });

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint" id={headingId}>
        Enter each matching pair. Learners see the right-hand items shuffled and match them back.
      </p>
      <div className="beat-config-pairs" role="group" aria-labelledby={headingId}>
        {form.pairs.map((pair, idx) => (
          <div key={pair.leftId} className="beat-config-pair-row">
            <input aria-label={`Left item ${idx + 1}`} value={pair.leftLabel} onChange={(e) => { const next = [...form.pairs]; next[idx] = { ...pair, leftLabel: e.target.value }; updatePairs(next); }} placeholder="Prompt / term" />
            <span className="beat-config-pair-arrow" aria-hidden="true">→</span>
            <input aria-label={`Right item ${idx + 1}`} value={pair.rightLabel} onChange={(e) => { const next = [...form.pairs]; next[idx] = { ...pair, rightLabel: e.target.value }; updatePairs(next); }} placeholder="Correct match" />
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => updatePairs(form.pairs.filter((_, i) => i !== idx))} disabled={!canRemove} aria-label="Remove pair">✕</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" onClick={() => updatePairs([...form.pairs, { leftId: freshId("l"), leftLabel: "", rightId: freshId("r"), rightLabel: "" }])} disabled={!canAdd}>+ Add pair</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="pairs" />
      <label className="form-row">
        <span>Hint (optional)</span>
        <input value={form.hint} onChange={(e) => onChange({ ...form, hint: e.target.value })} placeholder="Shown if the learner is stuck" />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
      <label className="beat-config-checkbox">
        <input type="checkbox" checked={form.partialCredit} onChange={(e) => onChange({ ...form, partialCredit: e.target.checked })} />
        <span>Give partial credit for partially-correct matches</span>
      </label>
    </div>
  );
}

// ----------------------------------------------------------------------------
// CONCEPT_REVEAL
// ----------------------------------------------------------------------------

function ConceptRevealFields({ form, onChange }: { form: ConceptRevealForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.CONCEPT_REVEAL;
  const canRemove = form.panels.length > (limits.minItems ?? 0);
  const canAdd = form.panels.length < (limits.maxItems ?? Infinity);
  const update = (panels: ConceptRevealForm["panels"]) => onChange({ ...form, panels });

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">
        Learners tap through every panel to continue. Add a panel per idea you want revealed.
      </p>
      <ol className="beat-config-list">
        {form.panels.map((panel, idx) => (
          <li key={panel.id} className="beat-config-card">
            <div className="beat-config-card-head">
              <span className="beat-config-index">{idx + 1}</span>
              <RowControls index={idx} count={form.panels.length} canRemove={canRemove} onMove={(i, d) => update(move(form.panels, i, d))} onRemove={() => update(form.panels.filter((_, i) => i !== idx))} />
            </div>
            <label className="form-row">
              <span>Panel title</span>
              <input value={panel.title} onChange={(e) => { const next = [...form.panels]; next[idx] = { ...panel, title: e.target.value }; update(next); }} placeholder="Headline for this panel" />
            </label>
            <label className="form-row">
              <span>Panel body</span>
              <textarea rows={3} value={panel.body} onChange={(e) => { const next = [...form.panels]; next[idx] = { ...panel, body: e.target.value }; update(next); }} placeholder="The teaching content revealed on this panel" />
            </label>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.panels, { id: freshId("panel"), title: "", body: "" }])} disabled={!canAdd}>+ Add panel</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="panels" />
      <FeedbackFields legend="Message after all panels are viewed" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// CONTENT_BLOCK
// ----------------------------------------------------------------------------

function ContentBlockFields({ form, onChange }: { form: ContentBlockForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.CONTENT_BLOCK;
  const canRemove = form.sections.length > (limits.minItems ?? 0);
  const canAdd = form.sections.length < (limits.maxItems ?? Infinity);
  const update = (sections: ContentBlockForm["sections"]) => onChange({ ...form, sections });

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">A reading beat — no answer key. Add sections of teaching content.</p>
      <ol className="beat-config-list">
        {form.sections.map((section, idx) => (
          <li key={section.id} className="beat-config-card">
            <div className="beat-config-card-head">
              <span className="beat-config-index">{idx + 1}</span>
              <RowControls index={idx} count={form.sections.length} canRemove={canRemove} onMove={(i, d) => update(move(form.sections, i, d))} onRemove={() => update(form.sections.filter((_, i) => i !== idx))} />
            </div>
            <label className="form-row">
              <span>Heading (optional)</span>
              <input value={section.heading} onChange={(e) => { const next = [...form.sections]; next[idx] = { ...section, heading: e.target.value }; update(next); }} placeholder="Sub-heading" />
            </label>
            <label className="form-row">
              <span>Body</span>
              <textarea rows={3} value={section.body} onChange={(e) => { const next = [...form.sections]; next[idx] = { ...section, body: e.target.value }; update(next); }} placeholder="Teaching prose for this section" />
            </label>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.sections, { id: freshId("section"), heading: "", body: "" }])} disabled={!canAdd}>+ Add section</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="sections" />
      <fieldset className="beat-config-feedback">
        <legend>Supporting image (optional)</legend>
        <label className="form-row">
          <span>Image URL</span>
          <input value={form.mediaUrl} onChange={(e) => onChange({ ...form, mediaUrl: e.target.value })} placeholder="https://…" />
        </label>
        {form.mediaUrl.trim() ? (
          <>
            <label className="form-row">
              <span>Alt text</span>
              <input value={form.mediaAlt} onChange={(e) => onChange({ ...form, mediaAlt: e.target.value })} placeholder="Describe the image" />
            </label>
            <label className="form-row">
              <span>Caption</span>
              <input value={form.mediaCaption} onChange={(e) => onChange({ ...form, mediaCaption: e.target.value })} placeholder="Caption shown under the image" />
            </label>
          </>
        ) : null}
      </fieldset>
      <FeedbackFields legend="Takeaway shown after reading" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// SCENARIO_CHOICE
// ----------------------------------------------------------------------------

function ScenarioChoiceFields({ form, onChange }: { form: ScenarioChoiceForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.SCENARIO_CHOICE;
  const canRemove = form.options.length > (limits.minItems ?? 0);
  const canAdd = form.options.length < (limits.maxItems ?? Infinity);
  const radioName = useId();

  function update(options: ScenarioChoiceForm["options"], correctOptionId = form.correctOptionId) {
    const stillValid = options.some((o) => o.id === correctOptionId);
    onChange({ ...form, options, correctOptionId: stillValid ? correctOptionId : options[0]?.id ?? "" });
  }

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">Add answer choices and select the one correct option.</p>
      <ol className="beat-config-list">
        {form.options.map((opt, idx) => (
          <li key={opt.id} className="beat-config-row">
            <label className="beat-config-correct-pick">
              <input type="radio" name={radioName} checked={form.correctOptionId === opt.id} onChange={() => onChange({ ...form, correctOptionId: opt.id })} aria-label={`Mark option ${idx + 1} correct`} />
              <span className="sr-only">Correct</span>
            </label>
            <input aria-label={`Option ${idx + 1}`} value={opt.label} onChange={(e) => { const next = [...form.options]; next[idx] = { ...opt, label: e.target.value }; update(next); }} placeholder="Answer choice" />
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => update(form.options.filter((_, i) => i !== idx))} disabled={!canRemove} aria-label="Remove option">✕</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.options, { id: freshId("opt"), label: "" }])} disabled={!canAdd}>+ Add option</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="options" />
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// MULTI_SELECT
// ----------------------------------------------------------------------------

function MultiSelectFields({ form, onChange }: { form: MultiSelectForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.MULTI_SELECT;
  const canRemove = form.options.length > (limits.minItems ?? 0);
  const canAdd = form.options.length < (limits.maxItems ?? Infinity);
  const update = (options: MultiSelectForm["options"]) => onChange({ ...form, options });

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">Tick every option that should be a correct selection.</p>
      <ol className="beat-config-list">
        {form.options.map((opt, idx) => (
          <li key={opt.id} className="beat-config-row">
            <label className="beat-config-correct-pick" title="Correct answer">
              <input type="checkbox" checked={opt.correct} onChange={(e) => { const next = [...form.options]; next[idx] = { ...opt, correct: e.target.checked }; update(next); }} aria-label={`Mark option ${idx + 1} correct`} />
            </label>
            <input aria-label={`Option ${idx + 1}`} value={opt.label} onChange={(e) => { const next = [...form.options]; next[idx] = { ...opt, label: e.target.value }; update(next); }} placeholder="Answer choice" />
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => update(form.options.filter((_, i) => i !== idx))} disabled={!canRemove} aria-label="Remove option">✕</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.options, { id: freshId("opt"), label: "", correct: false }])} disabled={!canAdd}>+ Add option</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="options" />
      <label className="form-row">
        <span>Scoring</span>
        <select value={form.scoringMode} onChange={(e) => onChange({ ...form, scoringMode: e.target.value === "threshold" ? "threshold" : "all-or-nothing" })}>
          <option value="all-or-nothing">All correct, none wrong</option>
          <option value="threshold">Threshold (minimum correct)</option>
        </select>
      </label>
      {form.scoringMode === "threshold" ? (
        <label className="form-row">
          <span>Minimum correct to pass</span>
          <input type="number" min={1} value={form.minimumCorrect ?? ""} onChange={(e) => onChange({ ...form, minimumCorrect: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Defaults to all correct options" />
        </label>
      ) : null}
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// SPOT_THE_MISTAKE
// ----------------------------------------------------------------------------

function SpotTheMistakeFields({ form, onChange }: { form: SpotTheMistakeForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.SPOT_THE_MISTAKE;
  const canRemove = form.targets.length > (limits.minItems ?? 0);
  const canAdd = form.targets.length < (limits.maxItems ?? Infinity);
  const radioName = useId();

  function update(targets: SpotTheMistakeForm["targets"], correctTargetId = form.correctTargetId) {
    const stillValid = targets.some((t) => t.id === correctTargetId);
    onChange({ ...form, targets, correctTargetId: stillValid ? correctTargetId : targets[0]?.id ?? "" });
  }

  return (
    <div className="beat-config">
      <label className="form-row">
        <span>Passage</span>
        <textarea rows={4} value={form.passage} onChange={(e) => onChange({ ...form, passage: e.target.value })} placeholder="The full passage the learner reads." required />
      </label>
      <p className="muted beat-config-hint">
        Add each clickable phrase exactly as it appears in the passage, then mark the one that is the mistake.
      </p>
      <ol className="beat-config-list">
        {form.targets.map((target, idx) => {
          const found = target.phrase.length > 0 && form.passage.includes(target.phrase);
          return (
            <li key={target.id} className="beat-config-row">
              <label className="beat-config-correct-pick" title="This is the mistake">
                <input type="radio" name={radioName} checked={form.correctTargetId === target.id} onChange={() => onChange({ ...form, correctTargetId: target.id })} aria-label={`Mark target ${idx + 1} as the mistake`} />
              </label>
              <div className="beat-config-stack">
                <input aria-label={`Phrase ${idx + 1}`} value={target.phrase} onChange={(e) => { const next = [...form.targets]; next[idx] = { ...target, phrase: e.target.value }; update(next); }} placeholder="Exact phrase from the passage" />
                <input aria-label={`Target ${idx + 1} label`} value={target.label} onChange={(e) => { const next = [...form.targets]; next[idx] = { ...target, label: e.target.value }; update(next); }} placeholder="Short label (for feedback)" />
                {target.phrase.length > 0 && !found ? <span className="form-error beat-config-hint">This phrase isn’t in the passage.</span> : null}
              </div>
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => update(form.targets.filter((_, i) => i !== idx))} disabled={!canRemove} aria-label="Remove target">✕</button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.targets, { id: freshId("target"), phrase: "", label: "" }])} disabled={!canAdd}>+ Add phrase</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="phrases" />
      <label className="form-row">
        <span>Hint (optional)</span>
        <input value={form.hint} onChange={(e) => onChange({ ...form, hint: e.target.value })} placeholder="Shown if the learner is stuck" />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// BRANCHING_SCENARIO
// ----------------------------------------------------------------------------

function BranchingScenarioFields({ form, onChange }: { form: BranchingScenarioForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.BRANCHING_SCENARIO;
  const canRemove = form.options.length > (limits.minItems ?? 0);
  const canAdd = form.options.length < (limits.maxItems ?? Infinity);
  const radioName = useId();

  function update(options: BranchingScenarioForm["options"], correctOptionId = form.correctOptionId) {
    const stillValid = options.some((o) => o.id === correctOptionId);
    onChange({ ...form, options, correctOptionId: stillValid ? correctOptionId : options[0]?.id ?? "" });
  }

  return (
    <div className="beat-config">
      <label className="form-row">
        <span>Scenario prompt</span>
        <textarea rows={3} value={form.rootPrompt} onChange={(e) => onChange({ ...form, rootPrompt: e.target.value })} placeholder="Describe the situation the learner faces." required />
      </label>
      <label className="beat-config-checkbox">
        <input type="checkbox" checked={form.noWrongAnswer} onChange={(e) => onChange({ ...form, noWrongAnswer: e.target.checked })} />
        <span>No wrong answer (every choice is accepted)</span>
      </label>
      <ol className="beat-config-list">
        {form.options.map((opt, idx) => (
          <li key={opt.id} className="beat-config-row">
            {!form.noWrongAnswer ? (
              <label className="beat-config-correct-pick" title="Correct choice">
                <input type="radio" name={radioName} checked={form.correctOptionId === opt.id} onChange={() => onChange({ ...form, correctOptionId: opt.id })} aria-label={`Mark option ${idx + 1} correct`} />
              </label>
            ) : <span className="beat-config-index" aria-hidden="true">{idx + 1}</span>}
            <div className="beat-config-stack">
              <input aria-label={`Option ${idx + 1}`} value={opt.label} onChange={(e) => { const next = [...form.options]; next[idx] = { ...opt, label: e.target.value }; update(next); }} placeholder="Choice the learner can pick" />
              <input aria-label={`Option ${idx + 1} leads to beat`} value={opt.leadsToChildSourceKey} onChange={(e) => { const next = [...form.options]; next[idx] = { ...opt, leadsToChildSourceKey: e.target.value }; update(next); }} placeholder="Leads to beat sourceKey (optional)" />
            </div>
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => update(form.options.filter((_, i) => i !== idx))} disabled={!canRemove} aria-label="Remove option">✕</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.options, { id: freshId("opt"), label: "", leadsToChildSourceKey: "" }])} disabled={!canAdd}>+ Add option</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="options" />
      <FeedbackFields legend={form.noWrongAnswer ? "Feedback shown after any choice" : "Feedback when correct"} value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// COMPARE
// ----------------------------------------------------------------------------

function CompareFields({ form, onChange }: { form: CompareForm; onChange: (n: BeatConfigForm) => void }) {
  const radioName = useId();
  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">Two options side by side. Mark which one is the stronger choice.</p>
      {(["A", "B"] as const).map((key) => {
        const opt = key === "A" ? form.optionA : form.optionB;
        const setOpt = (next: CompareForm["optionA"]) => onChange(key === "A" ? { ...form, optionA: next } : { ...form, optionB: next });
        return (
          <fieldset key={key} className="beat-config-feedback">
            <legend>
              <label className="beat-config-correct-pick beat-config-legend-pick">
                <input type="radio" name={radioName} checked={form.correctOptionId === key} onChange={() => onChange({ ...form, correctOptionId: key })} />
                <span>Option {key}{form.correctOptionId === key ? " (correct)" : ""}</span>
              </label>
            </legend>
            <label className="form-row">
              <span>Label</span>
              <input value={opt.label} onChange={(e) => setOpt({ ...opt, label: e.target.value })} placeholder={`Option ${key} title`} />
            </label>
            <label className="form-row">
              <span>Body</span>
              <textarea rows={3} value={opt.body} onChange={(e) => setOpt({ ...opt, body: e.target.value })} placeholder={`What option ${key} says`} />
            </label>
          </fieldset>
        );
      })}
      <label className="form-row">
        <span>Required rationale tag (optional)</span>
        <input value={form.requiredRationaleTag} onChange={(e) => onChange({ ...form, requiredRationaleTag: e.target.value })} placeholder="Learner must also pick this rationale" />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// HOTSPOT
// ----------------------------------------------------------------------------

const pct = (n: number) => Math.round(n * 1000) / 10; // 0..1 -> 0..100 (1 dp)
const fromPct = (n: number) => Math.round((n / 100) * 1e6) / 1e6;

function HotspotFields({ form, onChange }: { form: HotspotForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.HOTSPOT;
  const canRemove = form.regions.length > (limits.minItems ?? 0);
  const canAdd = form.regions.length < (limits.maxItems ?? Infinity);
  const radioName = useId();

  function update(regions: HotspotForm["regions"], correctRegionId = form.correctRegionId) {
    const stillValid = regions.some((r) => r.id === correctRegionId);
    onChange({ ...form, regions, correctRegionId: stillValid ? correctRegionId : regions[0]?.id ?? "" });
  }
  function setField(idx: number, key: "x" | "y" | "width" | "height", valuePct: number) {
    const next = [...form.regions];
    next[idx] = { ...next[idx], [key]: fromPct(valuePct) };
    update(next);
  }

  return (
    <div className="beat-config">
      <label className="form-row">
        <span>Image URL</span>
        <input value={form.imageUrl} onChange={(e) => onChange({ ...form, imageUrl: e.target.value })} placeholder="https://… (the image learners click)" required />
      </label>
      {form.imageUrl.trim() ? (
        <div className="beat-config-hotspot-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.imageUrl} alt="Hotspot preview" />
          {form.regions.map((r, idx) => (
            <span
              key={r.id}
              className={`beat-config-hotspot-box ${form.correctRegionId === r.id ? "is-correct" : ""}`}
              style={{ left: `${pct(r.x)}%`, top: `${pct(r.y)}%`, width: `${pct(r.width)}%`, height: `${pct(r.height)}%` }}
            >
              {idx + 1}
            </span>
          ))}
        </div>
      ) : null}
      <p className="muted beat-config-hint">Define clickable regions as percentages of the image. Mark the correct region.</p>
      <ol className="beat-config-list">
        {form.regions.map((region, idx) => (
          <li key={region.id} className="beat-config-card">
            <div className="beat-config-card-head">
              <label className="beat-config-correct-pick" title="Correct region">
                <input type="radio" name={radioName} checked={form.correctRegionId === region.id} onChange={() => onChange({ ...form, correctRegionId: region.id })} aria-label={`Mark region ${idx + 1} correct`} />
              </label>
              <span className="beat-config-index">{idx + 1}</span>
              <input aria-label={`Region ${idx + 1} label`} value={region.label} onChange={(e) => { const next = [...form.regions]; next[idx] = { ...region, label: e.target.value }; update(next); }} placeholder="Region label" />
              <RowControls index={idx} count={form.regions.length} canRemove={canRemove} onMove={(i, d) => update(move(form.regions, i, d))} onRemove={() => update(form.regions.filter((_, i) => i !== idx))} />
            </div>
            <div className="beat-config-inline">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key} className="form-row">
                  <span>{key} %</span>
                  <input type="number" min={0} max={100} step={0.1} value={pct(region[key])} onChange={(e) => setField(idx, key, Number(e.target.value))} />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => update([...form.regions, { id: freshId("region"), label: "", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }])} disabled={!canAdd}>+ Add region</button>
      <LimitNotes canAdd={canAdd} canRemove={canRemove} max={limits.maxItems} min={limits.minItems} noun="regions" />
      <label className="form-row">
        <span>Hint (optional)</span>
        <input value={form.hint} onChange={(e) => onChange({ ...form, hint: e.target.value })} placeholder="Shown if the learner is stuck" />
      </label>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// MESSAGE_COMPOSER
// ----------------------------------------------------------------------------

function MessageComposerFields({ form, onChange }: { form: MessageComposerForm; onChange: (n: BeatConfigForm) => void }) {
  const limits = STRUCTURED_KIND_LIMITS.MESSAGE_COMPOSER;
  const canRemovePool = form.pools.length > (limits.minItems ?? 0);
  const canAddPool = form.pools.length < (limits.maxItems ?? Infinity);
  const update = (pools: MessageComposerForm["pools"]) => onChange({ ...form, pools });

  function setPool(idx: number, next: PoolPatch) {
    const pools = [...form.pools];
    pools[idx] = { ...pools[idx], ...next };
    update(pools);
  }

  return (
    <div className="beat-config">
      <p className="muted beat-config-hint">
        Learners build a message by picking snippets from each pool. Required tags must be present; banned tags fail.
      </p>
      {form.pools.map((pool, pIdx) => (
        <fieldset key={pool.poolId} className="beat-config-feedback">
          <legend>Pool {pIdx + 1}</legend>
          <div className="beat-config-inline">
            <label className="form-row">
              <span>Pool label</span>
              <input value={pool.label} onChange={(e) => setPool(pIdx, { label: e.target.value })} placeholder="e.g. Opening line" />
            </label>
            <label className="form-row">
              <span>Min selections</span>
              <input type="number" min={0} value={pool.minSelections ?? ""} onChange={(e) => setPool(pIdx, { minSelections: e.target.value === "" ? null : Number(e.target.value) })} placeholder="1" />
            </label>
            <label className="form-row">
              <span>Max selections</span>
              <input type="number" min={1} value={pool.maxSelections ?? ""} onChange={(e) => setPool(pIdx, { maxSelections: e.target.value === "" ? null : Number(e.target.value) })} placeholder="1" />
            </label>
          </div>
          <div className="beat-config-list">
            {pool.snippets.map((snip, sIdx) => (
              <div key={snip.id} className="beat-config-row">
                <div className="beat-config-stack">
                  <input aria-label={`Pool ${pIdx + 1} snippet ${sIdx + 1} label`} value={snip.label} onChange={(e) => { const snippets = [...pool.snippets]; snippets[sIdx] = { ...snip, label: e.target.value }; setPool(pIdx, { snippets }); }} placeholder="Snippet text" />
                  <input aria-label={`Pool ${pIdx + 1} snippet ${sIdx + 1} tags`} value={snip.tags} onChange={(e) => { const snippets = [...pool.snippets]; snippets[sIdx] = { ...snip, tags: e.target.value }; setPool(pIdx, { snippets }); }} placeholder="tags, comma, separated" />
                </div>
                <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setPool(pIdx, { snippets: pool.snippets.filter((_, i) => i !== sIdx) })} aria-label="Remove snippet">✕</button>
              </div>
            ))}
          </div>
          <div className="beat-config-row-actions">
            <button type="button" className="btn btn-sm" onClick={() => setPool(pIdx, { snippets: [...pool.snippets, { id: freshId("snip"), label: "", tags: "" }] })}>+ Add snippet</button>
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => update(form.pools.filter((_, i) => i !== pIdx))} disabled={!canRemovePool}>Remove pool</button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => update([...form.pools, { poolId: freshId("pool"), label: "", minSelections: 1, maxSelections: 1, snippets: [{ id: freshId("snip"), label: "", tags: "" }] }])} disabled={!canAddPool}>+ Add pool</button>
      <LimitNotes canAdd={canAddPool} canRemove={canRemovePool} max={limits.maxItems} min={limits.minItems} noun="pools" />
      <div className="beat-config-inline">
        <label className="form-row">
          <span>Required tags</span>
          <input value={form.requiredTags} onChange={(e) => onChange({ ...form, requiredTags: e.target.value })} placeholder="warm, specific" />
        </label>
        <label className="form-row">
          <span>Banned tags</span>
          <input value={form.bannedTags} onChange={(e) => onChange({ ...form, bannedTags: e.target.value })} placeholder="dismissive, vague" />
        </label>
      </div>
      <FeedbackFields legend="Feedback when correct" value={form.correct} onChange={(correct) => onChange({ ...form, correct })} />
      <FeedbackFields legend="Default feedback when incorrect" value={form.incorrect} onChange={(incorrect) => onChange({ ...form, incorrect })} />
    </div>
  );
}

type PoolPatch = Partial<MessageComposerForm["pools"][number]>;
