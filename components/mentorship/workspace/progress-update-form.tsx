"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GoalRatingColor } from "@prisma/client";

import { Button, CardV2 } from "@/components/ui-v2";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { submitMonthlyProgressUpdate } from "@/lib/mentorship/progress-update-actions";
import { MONTHLY_UPDATE_RATINGS } from "@/lib/mentorship/monthly-progress-update-shared";

export type ProgressGoalDraft = {
  goalId: string;
  source: "gr" | "legacy";
  title: string;
  collaborateWith: string;
  objective: string;
  actionItems: string;
  rating: GoalRatingColor;
};

const fieldLabel = "text-[13px] font-semibold text-ink";
const fieldHint = "mt-0.5 text-[12.5px] font-normal text-ink-muted";
const fieldInput =
  "mt-2 w-full resize-y rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/70 focus:border-brand-400";

export function ProgressUpdateForm({
  mentorshipId,
  menteeId,
  menteeName,
  cycleLabel,
  requiresChairApproval,
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
      setError("Add overall comments.");
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

  return (
    <CardV2 padding="lg" className="flex flex-col gap-6">
      <div>
        <h3 className="m-0 text-[16px] font-bold text-ink">
          {cycleLabel} progress update
        </h3>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">
          Fill this out for {menteeName}, then send it
          {requiresChairApproval
            ? " — it goes to the chair first, then to them."
            : " straight to them."}
        </p>
      </div>

      <div>
        <p className={fieldLabel}>Overall rating</p>
        <p className={fieldHint}>Same scale as the Monthly Progress Update PDF.</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MONTHLY_UPDATE_RATINGS.map((value) => {
            const selected = overallRating === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setOverallRating(value);
                  setGoals((prev) => prev.map((g) => ({ ...g, rating: value })));
                }}
                disabled={pending}
                className={
                  selected
                    ? "rounded-[12px] border-2 border-brand-600 bg-brand-50 px-3 py-3 text-center text-[13.5px] font-bold text-brand-800"
                    : "rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[13.5px] font-semibold text-ink hover:border-brand-300"
                }
              >
                {RATING_LABELS[value]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col">
        <span className={fieldLabel}>Overall comments</span>
        <span className={fieldHint}>How they did this month, in a few sentences.</span>
        <textarea
          className={fieldInput}
          rows={4}
          value={overallComments}
          onChange={(e) => setOverallComments(e.target.value)}
          disabled={pending}
          placeholder="We hired them for… This month we saw…"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className={fieldLabel}>Strengths</span>
          <span className={fieldHint}>One per line is fine.</span>
          <textarea
            className={fieldInput}
            rows={3}
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            disabled={pending}
            placeholder={"Problem solving\nResponsive"}
          />
        </label>
        <label className="flex flex-col">
          <span className={fieldLabel}>Areas for development</span>
          <span className={fieldHint}>What to tighten next.</span>
          <textarea
            className={fieldInput}
            rows={3}
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            disabled={pending}
            placeholder={"Execution\nInitiative-taking"}
          />
        </label>
      </div>

      <label className="flex flex-col">
        <span className={fieldLabel}>Plan for next month</span>
        <span className={fieldHint}>High-level focus across their goals.</span>
        <textarea
          className={fieldInput}
          rows={3}
          value={planOfAction}
          onChange={(e) => setPlanOfAction(e.target.value)}
          disabled={pending}
          placeholder="Next month, prioritize…"
        />
      </label>

      {goals.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className={fieldLabel}>Goals for next month</p>
            <p className={fieldHint}>
              Per goal: who they collaborate with, progress / objective, and action items.
            </p>
          </div>
          {goals.map((g) => (
            <div
              key={g.goalId}
              className="rounded-[14px] border border-line-soft bg-surface-soft px-4 py-4"
            >
              <p className="m-0 text-[14.5px] font-bold text-ink">{g.title}</p>
              <label className="mt-3 flex flex-col">
                <span className="text-[12.5px] font-semibold text-ink">Collaborate with</span>
                <input
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
                  value={g.collaborateWith}
                  onChange={(e) => updateGoal(g.goalId, { collaborateWith: e.target.value })}
                  disabled={pending}
                  placeholder="Optional"
                />
              </label>
              <label className="mt-3 flex flex-col">
                <span className="text-[12.5px] font-semibold text-ink">
                  Progress / objective
                </span>
                <textarea
                  className={fieldInput}
                  rows={3}
                  value={g.objective}
                  onChange={(e) => updateGoal(g.goalId, { objective: e.target.value })}
                  disabled={pending}
                />
              </label>
              <label className="mt-3 flex flex-col">
                <span className="text-[12.5px] font-semibold text-ink">
                  Action items
                </span>
                <span className="text-[12px] text-ink-muted">One per line.</span>
                <textarea
                  className={fieldInput}
                  rows={3}
                  value={g.actionItems}
                  onChange={(e) => updateGoal(g.goalId, { actionItems: e.target.value })}
                  disabled={pending}
                  placeholder={"Ship X by Friday\nSchedule sync with Y"}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 rounded-[12px] border border-line-soft bg-surface-soft px-3.5 py-3 text-[13.5px] text-ink-muted">
          No active goals on their G&amp;R yet — you can still send the overall update.
        </p>
      )}

      {error ? (
        <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={submit} loading={pending}>
          {requiresChairApproval ? "Submit for chair approval" : "Send to mentee"}
        </Button>
      </div>
    </CardV2>
  );
}
