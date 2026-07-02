"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, cn } from "@/components/ui-v2";
import {
  completeReviewCycle,
  createCycleAction,
  openCycleForInput,
  releaseCycleSummary,
  requestCycleFeedback,
  scheduleCycleFollowUp,
  startReviewCycle,
  submitCycleSynthesis,
} from "@/lib/development/cycle-actions";
import { SYNTHESIS_PROMPTS } from "@/lib/development/cycle-flow";
import type { StartReviewOptions } from "@/lib/development/cycle-load";

/**
 * Manager-side forms for the review flow: start a cycle, open it, request
 * feedback, write the synthesis, and turn the review into actions and a
 * follow-up. Same calm idiom as the reviewee forms.
 */

const INPUT_CLASS =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400";

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>;
}

// ── Start a review ───────────────────────────────────────────────────────────

export function StartReviewForm({ options }: { options: StartReviewOptions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [revieweeId, setRevieweeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [dueDate, setDueDate] = useState("");

  const reviewee = useMemo(
    () => options.reviewees.find((r) => r.id === revieweeId) ?? null,
    [options.reviewees, revieweeId]
  );

  function handleSubmit() {
    setError(null);
    if (!revieweeId || !reviewerId) {
      setError("Pick the person being reviewed and their reviewer.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await startReviewCycle({
          revieweeId,
          reviewerId,
          type: reviewee?.population === "officer" ? "OFFICER" : "INSTRUCTOR",
          roleLabel: roleLabel.trim() || undefined,
          dueDate: dueDate ? new Date(`${dueDate}T12:00:00Z`) : undefined,
          openNow: true,
        });
        router.push(`/people/develop/reviews/${result.cycleId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the review.");
      }
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">Who is being reviewed?</span>
        <select
          value={revieweeId}
          onChange={(event) => setRevieweeId(event.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Choose a person…</option>
          {options.reviewees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} — {person.roleLabel}
            </option>
          ))}
        </select>
        {reviewee ? (
          <span className="text-[12px] text-ink-muted">
            This will be an {reviewee.population === "officer" ? "officer" : "instructor"}{" "}
            review.
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">Who runs the review?</span>
        <select
          value={reviewerId}
          onChange={(event) => setReviewerId(event.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Choose a reviewer…</option>
          {options.reviewers
            .filter((person) => person.id !== revieweeId)
            .map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">
          Role being reviewed <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          value={roleLabel}
          onChange={(event) => setRoleLabel(event.target.value)}
          placeholder="e.g. Lead Instructor · Robotics, Chapter President"
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">
          Review due <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <FormError error={error} />
      <div>
        <Button variant="primary" loading={isPending} onClick={handleSubmit}>
          Start review
        </Button>
      </div>
    </div>
  );
}

// ── Open a draft ─────────────────────────────────────────────────────────────

export function OpenForInputButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="primary"
        size="sm"
        loading={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await openCycleForInput({ cycleId });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not open the cycle.");
            }
          });
        }}
      >
        Open for input
      </Button>
      <FormError error={error} />
    </div>
  );
}

// ── Request feedback ─────────────────────────────────────────────────────────

export function RequestFeedbackForm({
  cycleId,
  contributorOptions,
  alreadyAskedIds,
}: {
  cycleId: string;
  contributorOptions: Array<{ id: string; name: string }>;
  alreadyAskedIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contributorId, setContributorId] = useState("");
  const [reason, setReason] = useState("");

  const askable = contributorOptions.filter(
    (person) => !alreadyAskedIds.includes(person.id)
  );

  function handleSubmit() {
    setError(null);
    if (!contributorId) {
      setError("Pick who to ask.");
      return;
    }
    startTransition(async () => {
      try {
        await requestCycleFeedback({
          cycleId,
          contributorIds: [contributorId],
          reason: reason.trim() || undefined,
        });
        setContributorId("");
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send the request.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={contributorId}
          onChange={(event) => setContributorId(event.target.value)}
          className={cn(INPUT_CLASS, "sm:max-w-[260px]")}
          aria-label="Contributor"
        >
          <option value="">Ask someone for feedback…</option>
          {askable.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why them? (shown on their form, optional)"
          className={INPUT_CLASS}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={isPending}
          onClick={handleSubmit}
          className="shrink-0"
        >
          Send request
        </Button>
      </div>
      <FormError error={error} />
    </div>
  );
}

// ── Synthesis ────────────────────────────────────────────────────────────────

export function SynthesisForm({
  cycleId,
  initial,
  submitted,
}: {
  cycleId: string;
  initial: {
    strengths: string | null;
    growthAreas: string | null;
    concerns: string | null;
    coachingNotes: string | null;
    recommendedNextStep: string | null;
    recognitionFlag: boolean;
    leadershipFlag: boolean;
  };
  submitted: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({
    strengths: initial.strengths ?? "",
    growthAreas: initial.growthAreas ?? "",
    concerns: initial.concerns ?? "",
    coachingNotes: initial.coachingNotes ?? "",
    recommendedNextStep: initial.recommendedNextStep ?? "",
  });
  const [recognitionFlag, setRecognitionFlag] = useState(initial.recognitionFlag);
  const [leadershipFlag, setLeadershipFlag] = useState(initial.leadershipFlag);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitCycleSynthesis({
          cycleId,
          ...values,
          recognitionFlag,
          leadershipFlag,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the synthesis.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {SYNTHESIS_PROMPTS.map((prompt) => (
        <label key={prompt.key} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">
            {prompt.label}
            {prompt.leadershipOnly ? (
              <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                Never shown to reviewee
              </span>
            ) : null}
          </span>
          <textarea
            value={values[prompt.key] ?? ""}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, [prompt.key]: event.target.value }))
            }
            rows={prompt.key === "recommendedNextStep" ? 2 : 3}
            className={cn(INPUT_CLASS, "resize-y leading-relaxed")}
          />
        </label>
      ))}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={recognitionFlag}
            onChange={(event) => setRecognitionFlag(event.target.checked)}
            className="size-4 accent-brand-600"
          />
          Recommend recognition or promotion consideration
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={leadershipFlag}
            onChange={(event) => setLeadershipFlag(event.target.checked)}
            className="size-4 accent-brand-600"
          />
          Flag this review for leadership attention
        </label>
      </div>

      <FormError error={error} />
      <div>
        <Button variant="primary" loading={isPending} onClick={handleSubmit}>
          {submitted ? "Update synthesis" : "Save synthesis & move to action plan"}
        </Button>
      </div>
    </div>
  );
}

// ── Action plan ──────────────────────────────────────────────────────────────

export function CreateActionForm({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");

  function handleSubmit() {
    setError(null);
    if (!title.trim() || !deadline) {
      setError("Give the action a title and a deadline.");
      return;
    }
    startTransition(async () => {
      try {
        await createCycleAction({
          cycleId,
          title: title.trim(),
          deadline: new Date(`${deadline}T12:00:00Z`),
        });
        setTitle("");
        setDeadline("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create the action.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Coaching action, e.g. “Shadow Maya's class and debrief”"
          className={INPUT_CLASS}
        />
        <input
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className={cn(INPUT_CLASS, "sm:max-w-[170px]")}
          aria-label="Deadline"
        />
        <Button
          variant="secondary"
          size="sm"
          loading={isPending}
          onClick={handleSubmit}
          className="shrink-0"
        >
          Create action
        </Button>
      </div>
      <FormError error={error} />
    </div>
  );
}

export function ScheduleFollowUpForm({
  cycleId,
  currentDueAt,
  currentNote,
}: {
  cycleId: string;
  currentDueAt: string | null;
  currentNote: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(currentDueAt ?? "");
  const [note, setNote] = useState(currentNote ?? "");

  function handleSubmit() {
    setError(null);
    if (!dueDate) {
      setError("Pick the follow-up date.");
      return;
    }
    startTransition(async () => {
      try {
        await scheduleCycleFollowUp({
          cycleId,
          followUpDueAt: new Date(`${dueDate}T12:00:00Z`),
          note: note.trim() || undefined,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not schedule the follow-up.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className={cn(INPUT_CLASS, "sm:max-w-[170px]")}
          aria-label="Follow-up date"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What the follow-up should confirm (optional)"
          className={INPUT_CLASS}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={isPending}
          onClick={handleSubmit}
          className="shrink-0"
        >
          {currentDueAt ? "Reschedule follow-up" : "Schedule follow-up"}
        </Button>
      </div>
      <FormError error={error} />
    </div>
  );
}

export function CycleCompletionControls({
  cycleId,
  released,
  canComplete,
}: {
  cycleId: string;
  released: boolean;
  canComplete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {!released ? (
          <Button
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={() => run(() => releaseCycleSummary({ cycleId }))}
          >
            Release summary to reviewee
          </Button>
        ) : (
          <span className="text-[12.5px] font-medium text-success-700">
            Summary released to the reviewee
          </span>
        )}
        {canComplete ? (
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            onClick={() => run(() => completeReviewCycle({ cycleId, release: true }))}
          >
            Complete review
          </Button>
        ) : null}
      </div>
      <p className="m-0 text-[12px] text-ink-muted">
        The released summary carries strengths, growth areas, and the recommended
        next step — never concerns or coaching notes.
      </p>
      <FormError error={error} />
    </div>
  );
}
