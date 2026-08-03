"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui-v2";
import { createAndActivateCustomGRDocument } from "@/lib/gr-actions";

type GoalDraft = {
  title: string;
  description: string;
  timePhase: string;
  priority: string;
  dueDate: string;
  /** Empty string = no quantitative target. */
  targetCount: string;
  targetUnit: string;
};

const TIME_PHASE_OPTIONS = [
  { value: "MONTHLY", label: "This cycle" },
  { value: "FIRST_MONTH", label: "First month" },
  { value: "FIRST_QUARTER", label: "First quarter" },
  { value: "LONG_TERM", label: "Long-term" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

/** Common countable outputs mentors can attach as measurable targets. */
const UNIT_PRESETS = [
  { unit: "newsletters", label: "Newsletters" },
  { unit: "classes", label: "Classes" },
  { unit: "events", label: "Events" },
  { unit: "meetings", label: "Meetings" },
  { unit: "parent calls", label: "Parent calls" },
  { unit: "posts", label: "Posts" },
] as const;

function emptyGoal(): GoalDraft {
  return {
    title: "",
    description: "",
    timePhase: "MONTHLY",
    priority: "NORMAL",
    dueDate: "",
    targetCount: "",
    targetUnit: "",
  };
}

/**
 * Inline G&R creation on the mentee's Goals tab — mentor or admin fills in
 * mission + goals here (no separate admin page, no template required).
 * Optional quantitative targets (e.g. 3 newsletters) become KPI definitions.
 */
export function AssignGoalsForm({
  personId,
  mentorshipId,
}: {
  personId: string;
  mentorshipId: string;
}) {
  const [roleMission, setRoleMission] = useState("");
  const [goals, setGoals] = useState<GoalDraft[]>([emptyGoal()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateGoal(index: number, patch: Partial<GoalDraft>) {
    setGoals((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const cleaned = goals
      .map((g) => {
        const countRaw = g.targetCount.trim();
        const unit = g.targetUnit.trim();
        const count = countRaw ? Number(countRaw) : null;
        if (countRaw && (!Number.isInteger(count) || (count ?? 0) < 1)) {
          throw new Error(`“${g.title || "Goal"}” needs a whole number target (e.g. 3).`);
        }
        if ((count && !unit) || (!count && unit)) {
          throw new Error(
            `“${g.title || "Goal"}” needs both a number and a unit (e.g. 3 newsletters).`
          );
        }
        return {
          title: g.title.trim(),
          description: g.description.trim(),
          timePhase: g.timePhase || "MONTHLY",
          priority: g.priority || "NORMAL",
          dueDate: g.dueDate.trim() || null,
          targetCount: count,
          targetUnit: unit || null,
        };
      })
      .filter((g) => g.title.length > 0);

    if (cleaned.length === 0) {
      setError("Add at least one goal with a title.");
      return;
    }

    const fd = new FormData();
    fd.set("userId", personId);
    fd.set("mentorshipId", mentorshipId);
    fd.set("roleStartDate", new Date().toISOString().slice(0, 10));
    fd.set("roleMission", roleMission.trim());
    fd.set("goalsJson", JSON.stringify(cleaned));

    startTransition(async () => {
      try {
        await createAndActivateCustomGRDocument(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add goals.");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        try {
          onSubmit(e);
        } catch (err) {
          e.preventDefault();
          setError(err instanceof Error ? err.message : "Check the goals and try again.");
        }
      }}
      className="flex w-full flex-col gap-6 text-left"
    >
      <label className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Big picture (optional)
        </span>
        <textarea
          value={roleMission}
          onChange={(e) => setRoleMission(e.target.value)}
          rows={2}
          placeholder="What this role is about for them"
          className="w-full resize-none rounded-[12px] border border-transparent bg-surface-soft px-4 py-3 text-[14px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-muted/70 focus:border-brand-300 focus:bg-surface"
        />
      </label>

      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Goals
        </p>

        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          {goals.map((goal, index) => (
            <div
              key={index}
              className={
                index > 0 ? "border-t border-line px-5 py-5" : "px-5 py-5"
              }
            >
              <div className="flex items-start gap-3">
                <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <input
                      value={goal.title}
                      onChange={(e) => updateGoal(index, { title: e.target.value })}
                      placeholder="What should they work toward?"
                      className="w-full border-0 bg-transparent p-0 text-[16px] font-semibold tracking-[-0.2px] text-ink outline-none placeholder:font-medium placeholder:text-ink-muted/60"
                    />
                    {goals.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setGoals((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="shrink-0 pt-1 text-[12.5px] font-medium text-ink-muted hover:text-ink"
                        aria-label={`Remove goal ${index + 1}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <textarea
                    value={goal.description}
                    onChange={(e) =>
                      updateGoal(index, { description: e.target.value })
                    }
                    rows={2}
                    placeholder="A sentence on what success looks like (optional)"
                    className="mt-2 w-full resize-none border-0 bg-transparent p-0 text-[13.5px] leading-relaxed text-ink-muted outline-none placeholder:text-ink-muted/55"
                  />

                  <div className="mt-3 rounded-[12px] border border-line-soft bg-surface-soft px-3.5 py-3">
                    <p className="m-0 text-[12px] font-semibold text-ink">
                      Measurable target{" "}
                      <span className="font-normal text-ink-muted">(optional)</span>
                    </p>
                    <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
                      How many of something should they deliver?{" "}
                      <span className="italic">Example: 3 newsletters this cycle.</span>
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <label className="flex flex-col gap-1 text-[11.5px] font-medium text-ink-muted">
                        <span>How many?</span>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          inputMode="numeric"
                          value={goal.targetCount}
                          onChange={(e) =>
                            updateGoal(index, { targetCount: e.target.value })
                          }
                          placeholder="e.g. 3"
                          className="h-9 w-16 rounded-[10px] border border-line bg-surface px-2.5 text-center text-[14px] font-semibold text-ink outline-none focus:border-brand-400"
                        />
                      </label>
                      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11.5px] font-medium text-ink-muted">
                        <span>What are they delivering?</span>
                        <input
                          value={goal.targetUnit}
                          onChange={(e) =>
                            updateGoal(index, { targetUnit: e.target.value })
                          }
                          placeholder="e.g. newsletters"
                          list={`goal-units-${index}`}
                          className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-brand-400"
                        />
                      </label>
                      <datalist id={`goal-units-${index}`}>
                        {UNIT_PRESETS.map((p) => (
                          <option key={p.unit} value={p.unit} />
                        ))}
                      </datalist>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {UNIT_PRESETS.map((p) => {
                        const selected = goal.targetUnit === p.unit;
                        return (
                          <button
                            key={p.unit}
                            type="button"
                            onClick={() =>
                              updateGoal(index, {
                                targetUnit: p.unit,
                                targetCount: goal.targetCount || "3",
                              })
                            }
                            className={
                              selected
                                ? "rounded-full bg-brand-600 px-2.5 py-1 text-[11.5px] font-semibold text-white"
                                : "rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-muted hover:bg-line/60 hover:text-ink"
                            }
                          >
                            {p.label}
                          </button>
                        );
                      })}
                      {goal.targetCount || goal.targetUnit ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateGoal(index, { targetCount: "", targetUnit: "" })
                          }
                          className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-ink-muted hover:text-ink"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    {goal.targetCount && goal.targetUnit ? (
                      <p className="m-0 mt-2 text-[12.5px] font-medium text-brand-800">
                        Target: {goal.targetCount} {goal.targetUnit}
                      </p>
                    ) : null}
                  </div>

                  <details className="mt-3 group">
                    <summary className="cursor-pointer list-none text-[12.5px] font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">More options</span>
                      <span className="hidden group-open:inline">Fewer options</span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {TIME_PHASE_OPTIONS.map((o) => {
                          const selected = goal.timePhase === o.value;
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => updateGoal(index, { timePhase: o.value })}
                              className={
                                selected
                                  ? "rounded-full bg-brand-600 px-3 py-1 text-[12px] font-semibold text-white"
                                  : "rounded-full bg-surface-soft px-3 py-1 text-[12px] font-medium text-ink-muted hover:bg-line/60 hover:text-ink"
                              }
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                            Priority
                          </span>
                          <select
                            value={goal.priority}
                            onChange={(e) =>
                              updateGoal(index, { priority: e.target.value })
                            }
                            className="h-9 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400"
                          >
                            {PRIORITY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                            Due date
                          </span>
                          <input
                            type="date"
                            value={goal.dueDate}
                            onChange={(e) =>
                              updateGoal(index, { dueDate: e.target.value })
                            }
                            className="h-9 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400"
                          />
                        </label>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setGoals((prev) => [...prev, emptyGoal()])}
          className="self-start rounded-[10px] px-1 py-1 text-[13px] font-semibold text-brand-700 hover:underline"
        >
          + Add another goal
        </button>
      </div>

      {error ? <p className="m-0 text-[13px] text-danger-700">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" loading={pending}>
          Save goals
        </Button>
        <p className="m-0 text-[12.5px] text-ink-muted">
          They’ll see these on their Goals tab right away.
        </p>
      </div>
    </form>
  );
}
