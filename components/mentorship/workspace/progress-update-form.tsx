"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GoalRatingColor } from "@prisma/client";

import { Button, CardV2 } from "@/components/ui-v2";
import {
  RATING_ORDER,
  getGoalRatingCopy,
} from "@/lib/mentorship-rubric-copy";
import { submitMonthlyProgressUpdate } from "@/lib/mentorship/progress-update-actions";
import type { ProgressRubricContext } from "@/lib/mentorship/progress-rubric";

export type ProgressGoalDraft = {
  goalId: string;
  source: "gr" | "legacy";
  title: string;
  collaborateWith: string;
  objective: string;
  actionItems: string;
  rating: GoalRatingColor;
  /** G&R expectation bullets for this mentee's band. */
  expectationBullets: string[];
};

const fieldLabel = "text-[13px] font-semibold text-ink";
const fieldHint = "mt-0.5 text-[12.5px] font-normal text-ink-muted";
const fieldInput =
  "mt-2 w-full resize-y rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/70 focus:border-brand-400";

function RatingScaleLegend() {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-line-soft bg-surface-soft">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption className="sr-only">Leadership Goals &amp; Rubric rating scale</caption>
        <thead>
          <tr>
            {RATING_ORDER.map((value) => {
              const copy = getGoalRatingCopy(value);
              return (
                <th
                  key={value}
                  scope="col"
                  className="border-b border-line-soft px-3 py-2.5 text-[12.5px] font-bold"
                  style={{ color: copy.color, background: copy.background }}
                >
                  {copy.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {RATING_ORDER.map((value) => {
              const copy = getGoalRatingCopy(value);
              return (
                <td
                  key={value}
                  className="border-r border-line-soft px-3 py-2.5 text-[12px] leading-snug text-ink-muted last:border-r-0"
                >
                  {copy.mentorDescription}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RatingPicker({
  value,
  onChange,
  disabled,
  name,
}: {
  value: GoalRatingColor;
  onChange: (next: GoalRatingColor) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {RATING_ORDER.map((rating) => {
        const copy = getGoalRatingCopy(rating);
        const selected = value === rating;
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(rating)}
            disabled={disabled}
            className={
              selected
                ? "rounded-[12px] border-2 px-2.5 py-2.5 text-center text-[12.5px] font-bold leading-snug"
                : "rounded-[12px] border border-line bg-surface px-2.5 py-2.5 text-center text-[12.5px] font-semibold leading-snug text-ink hover:border-brand-300"
            }
            style={
              selected
                ? {
                    borderColor: copy.color,
                    background: copy.background,
                    color: copy.color,
                  }
                : undefined
            }
          >
            {copy.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressUpdateForm({
  mentorshipId,
  menteeId,
  menteeName,
  cycleLabel,
  requiresChairApproval,
  isUpdate = false,
  rubric,
  bandReference,
  initialOverallRating,
  initialOverallComments,
  initialStrengths,
  initialAreas,
  initialPlan,
  initialGoals,
}: {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  cycleLabel: string;
  requiresChairApproval: boolean;
  /** True when a progress update for this month was already sent — mentor is revising. */
  isUpdate?: boolean;
  rubric: ProgressRubricContext;
  /** Full band competency reference when the mentee has no active G&R goals yet. */
  bandReference?: Array<{ number: number; title: string; bullets: string[] }>;
  initialOverallRating?: GoalRatingColor | null;
  initialOverallComments?: string;
  initialStrengths?: string;
  initialAreas?: string;
  initialPlan?: string;
  initialGoals: ProgressGoalDraft[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [overallRating, setOverallRating] = useState<GoalRatingColor>(
    initialOverallRating ?? "ACHIEVED"
  );
  const [overallComments, setOverallComments] = useState(initialOverallComments ?? "");
  const [strengths, setStrengths] = useState(initialStrengths ?? "");
  const [areas, setAreas] = useState(initialAreas ?? "");
  const [planOfAction, setPlanOfAction] = useState(initialPlan ?? "");
  const [goals, setGoals] = useState<ProgressGoalDraft[]>(initialGoals);

  function updateGoal(goalId: string, patch: Partial<ProgressGoalDraft>) {
    setGoals((prev) => prev.map((g) => (g.goalId === goalId ? { ...g, ...patch } : g)));
  }

  function submit() {
    if (!overallComments.trim()) {
      setError("Add overall comments — the written summary of their progress.");
      return;
    }
    if (!strengths.trim()) {
      setError("List at least one strength.");
      return;
    }
    if (!areas.trim()) {
      setError("List at least one area for development.");
      return;
    }
    if (!planOfAction.trim()) {
      setError("Add a short plan for next month.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const result = await submitMonthlyProgressUpdate({
          mentorshipId,
          menteeId,
          overallRating,
          overallComments: overallComments.trim(),
          strengths: strengths.trim(),
          areasForDevelopment: areas.trim(),
          planOfAction: planOfAction.trim(),
          goals: goals.map((g) => ({
            goalId: g.goalId,
            source: g.source,
            rating: g.rating || overallRating,
            collaborateWith: g.collaborateWith,
            objective: g.objective.trim() || planOfAction.trim(),
            actionItems: g.actionItems,
          })),
        });
        router.push(
          `/mentorship/people/${menteeId}?section=progress${
            result.released ? "&progressSent=1" : "&progressPending=1"
          }`
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send. Try again.");
      }
    });
  }

  const roleLine = rubric.roleSubtitle
    ? `${rubric.roleLabel} · ${rubric.roleSubtitle}`
    : rubric.roleLabel;

  return (
    <CardV2 padding="lg" className="flex flex-col gap-6 border-2 border-brand-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[52ch]">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.07em] text-brand-700">
            Leadership Goals &amp; Rubric
          </p>
          <h3 className="m-0 mt-1 text-[18px] font-bold text-ink">
            {cycleLabel} progress update
          </h3>
          <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">
            Written progress for {menteeName} against their G&amp;R band (
            {roleLine}). Rate each competency, then write how they met the
            bullets.
            {requiresChairApproval
              ? " Sends to the chair first, then to them."
              : " Sends straight to them."}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={submit}
          loading={pending}
          className="shrink-0"
        >
          {isUpdate
            ? requiresChairApproval
              ? "Send updated version to chair"
              : "Send updated version"
            : requiresChairApproval
              ? "Send to chair"
              : "Send update"}
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <p className={fieldLabel}>Rating scale</p>
        <RatingScaleLegend />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <p className={fieldLabel}>Overall rating</p>
          <p className={fieldHint}>
            How they landed across the rubric this month.
          </p>
        </div>
        <RatingPicker
          name="Overall rating"
          value={overallRating}
          disabled={pending}
          onChange={(value) => {
            setOverallRating(value);
            setGoals((prev) => prev.map((g) => ({ ...g, rating: value })));
          }}
        />
      </section>

      <label className="flex flex-col">
        <span className={fieldLabel}>Overall comments</span>
        <span className={fieldHint}>
          The written version of their progress — a few sentences tying the
          ratings together.
        </span>
        <textarea
          className={fieldInput}
          rows={4}
          value={overallComments}
          onChange={(e) => setOverallComments(e.target.value)}
          disabled={pending}
          placeholder="This month against the G&R… We saw…"
        />
      </label>

      {goals.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div>
            <p className={fieldLabel}>Competencies</p>
            <p className={fieldHint}>
              Same layout as G&amp;R — bullets for their level, then rating and
              written progress.
            </p>
          </div>
          {goals.map((g, index) => (
            <div
              key={g.goalId}
              className="overflow-hidden rounded-[14px] border border-line"
            >
              <div className="border-b border-line-soft bg-surface-soft px-4 py-3">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Competency {index + 1}
                </p>
                <p className="m-0 mt-0.5 text-[15px] font-bold text-ink">{g.title}</p>
              </div>

              {g.expectationBullets.length > 0 ? (
                <ul className="m-0 list-disc space-y-1.5 border-b border-line-soft bg-surface px-4 py-3 pl-8 text-[13px] leading-relaxed text-ink">
                  {g.expectationBullets.map((bullet) => (
                    <li key={bullet.slice(0, 48)}>{bullet}</li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-col gap-4 px-4 py-4">
                <div>
                  <p className="m-0 text-[12.5px] font-semibold text-ink">Rating</p>
                  <div className="mt-2">
                    <RatingPicker
                      name={`${g.title} rating`}
                      value={g.rating}
                      disabled={pending}
                      onChange={(rating) => updateGoal(g.goalId, { rating })}
                    />
                  </div>
                </div>

                <label className="flex flex-col">
                  <span className="text-[12.5px] font-semibold text-ink">
                    Written progress
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    How they met (or missed) these bullets this month.
                  </span>
                  <textarea
                    className={fieldInput}
                    rows={3}
                    value={g.objective}
                    onChange={(e) =>
                      updateGoal(g.goalId, { objective: e.target.value })
                    }
                    disabled={pending}
                    placeholder="Evidence against the bullets…"
                  />
                </label>

                <label className="flex flex-col">
                  <span className="text-[12.5px] font-semibold text-ink">
                    Collaborate with
                  </span>
                  <input
                    className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
                    value={g.collaborateWith}
                    onChange={(e) =>
                      updateGoal(g.goalId, { collaborateWith: e.target.value })
                    }
                    disabled={pending}
                    placeholder="Optional"
                  />
                </label>

                <label className="flex flex-col">
                  <span className="text-[12.5px] font-semibold text-ink">
                    Action items for next month
                  </span>
                  <span className="text-[12px] text-ink-muted">One per line.</span>
                  <textarea
                    className={fieldInput}
                    rows={3}
                    value={g.actionItems}
                    onChange={(e) =>
                      updateGoal(g.goalId, { actionItems: e.target.value })
                    }
                    disabled={pending}
                    placeholder={"Close remaining bullets on…\nSchedule sync with…"}
                  />
                </label>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="m-0 rounded-[12px] border border-line-soft bg-surface-soft px-3.5 py-3 text-[13.5px] text-ink-muted">
            No active G&amp;R goals yet — write the overall assessment below.
            {bandReference && bandReference.length > 0
              ? " Their band expectations are shown for reference."
              : ""}
          </p>
          {bandReference && bandReference.length > 0 ? (
            <details className="rounded-[14px] border border-line-soft">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13.5px] font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                {rubric.trackLabel} · {roleLine} expectations
              </summary>
              <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3">
                {bandReference.map((row) => (
                  <div key={row.title}>
                    <p className="m-0 text-[13.5px] font-bold text-ink">
                      {row.number} · {row.title}
                    </p>
                    <ul className="m-0 mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-ink-muted">
                      {row.bullets.map((b) => (
                        <li key={b.slice(0, 40)}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className={fieldLabel}>Strengths</span>
          <span className={fieldHint}>Where they exceeded or clearly met bullets.</span>
          <textarea
            className={fieldInput}
            rows={3}
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            disabled={pending}
            placeholder={"Impact & Results\nReliability"}
          />
        </label>
        <label className="flex flex-col">
          <span className={fieldLabel}>Areas for development</span>
          <span className={fieldHint}>Bullets that need attention next month.</span>
          <textarea
            className={fieldInput}
            rows={3}
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            disabled={pending}
            placeholder={"Ideas & Initiative\nContinuity"}
          />
        </label>
      </div>

      <label className="flex flex-col">
        <span className={fieldLabel}>Plan for next month</span>
        <span className={fieldHint}>
          How you&apos;ll close gaps and stretch toward Above &amp; Beyond.
        </span>
        <textarea
          className={fieldInput}
          rows={3}
          value={planOfAction}
          onChange={(e) => setPlanOfAction(e.target.value)}
          disabled={pending}
          placeholder="Next month, prioritize…"
        />
      </label>

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={submit} loading={pending}>
          {isUpdate
            ? requiresChairApproval
              ? "Submit updated version for chair"
              : "Send updated version"
            : requiresChairApproval
              ? "Submit for chair approval"
              : "Send to mentee"}
        </Button>
      </div>
    </CardV2>
  );
}
