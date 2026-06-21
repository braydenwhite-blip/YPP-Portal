"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import type {
  SpecificityField,
  TaggedImpactIssue,
} from "@/lib/people-strategy/impact-specificity";
import {
  addWeeklyTaskDeliverable,
  submitMyMemberUpdate,
  updateMyMemberUpdate,
  updateWeeklyTaskUpdate,
} from "@/lib/people-strategy/weekly-team-brief-actions";
import type {
  MyWeeklyImpactTeamForm,
  WeeklyBriefTaskUpdateDTO,
} from "@/lib/people-strategy/weekly-team-briefs";

const textareaClass =
  "min-h-[72px] w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-60";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-60";
const errorRing = "border-red-400 ring-1 ring-red-300";

function statusTone(status: string): StatusTone {
  if (status === "FINALIZED") return "success";
  if (status === "SUBMITTED" || status === "PRESENTED") return "warning";
  if (status === "REOPENED") return "info";
  return "neutral";
}

function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

type TaskState = {
  workCompleted: string;
  currentResult: string;
  nextAction: string;
  blockerNote: string;
  decisionNeeded: string;
  newLabel: string;
  newUrl: string;
};

function initialTaskState(t: WeeklyBriefTaskUpdateDTO): TaskState {
  return {
    workCompleted: t.workCompleted ?? "",
    currentResult: t.currentResult ?? "",
    nextAction: t.nextAction ?? "",
    blockerNote: t.blockerNote ?? "",
    decisionNeeded: t.decisionNeeded ?? "",
    newLabel: "",
    newUrl: "",
  };
}

export function MyWeeklyImpactForm({ team }: { team: MyWeeklyImpactTeamForm }) {
  const router = useRouter();
  const { form } = team;
  const locked = team.briefStatus === "FINALIZED";
  const submitted = form.status === "SUBMITTED" || form.status === "PRESENTED";

  const [objective, setObjective] = useState(form.personalObjective ?? "");
  const [deliverable, setDeliverable] = useState(form.personalDeliverable ?? "");
  const [targetDate, setTargetDate] = useState(isoToDateInput(form.targetDateISO));
  const [inputNeeded, setInputNeeded] = useState(form.inputNeeded ?? "");
  const [inputFrom, setInputFrom] = useState(form.inputNeededFrom ?? "");
  const [inputBy, setInputBy] = useState(isoToDateInput(form.inputNeededByISO));
  const [tasks, setTasks] = useState<Record<string, TaskState>>(
    Object.fromEntries(form.taskUpdates.map((t) => [t.id, initialTaskState(t)]))
  );

  const [issues, setIssues] = useState<TaggedImpactIssue[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setTask(id: string, patch: Partial<TaskState>) {
    setTasks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function issuesFor(field: SpecificityField, taskUpdateId?: string): TaggedImpactIssue[] {
    return issues.filter(
      (i) => i.field === field && (i.taskUpdateId ?? undefined) === taskUpdateId
    );
  }
  function hasIssue(field: SpecificityField, taskUpdateId?: string): boolean {
    return issuesFor(field, taskUpdateId).length > 0;
  }

  function memberPayload() {
    return {
      memberUpdateId: form.id,
      personalObjective: objective,
      personalDeliverable: deliverable,
      targetDate,
      inputNeeded,
      inputNeededFrom: inputFrom,
      inputNeededBy: inputBy,
    };
  }

  function taskPayload(t: WeeklyBriefTaskUpdateDTO) {
    const s = tasks[t.id];
    // Pass through the team-lead/officer-managed fields so a personal save never
    // clobbers them; override only the person-authored Section 2/3 fields.
    return {
      updateId: t.id,
      statusNarrative: t.statusNarrative ?? "",
      workCompleted: s.workCompleted,
      currentResult: s.currentResult,
      remainingWork: t.remainingWork ?? "",
      blockerNote: s.blockerNote,
      explanation: t.explanation ?? "",
      decisionNeeded: s.decisionNeeded,
      nextAction: s.nextAction,
      teamMeetingPresenterId: t.teamMeetingPresenter?.id ?? "",
      officerMeetingPresenterId: t.officerMeetingPresenter?.id ?? "",
      teamMeetingReady: t.teamMeetingReady,
      officerMeetingReady: t.officerMeetingReady,
      escalationNeeded: t.escalationNeeded,
      officerReviewRequested: t.officerReviewRequested,
    };
  }

  async function persistAll() {
    await updateMyMemberUpdate(memberPayload());
    for (const t of form.taskUpdates) {
      await updateWeeklyTaskUpdate(taskPayload(t));
    }
  }

  function saveDraft() {
    setNote(null);
    startTransition(async () => {
      await persistAll();
      setNote("Saved. Your changes are in — submit when you're ready.");
      router.refresh();
    });
  }

  function submit() {
    setNote(null);
    startTransition(async () => {
      await persistAll();
      const res = await submitMyMemberUpdate({ memberUpdateId: form.id });
      if (res.ok) {
        setIssues([]);
        setNote("Submitted ✓ — your update is in for this week's Impact Meeting.");
        router.refresh();
      } else {
        setIssues(res.issues);
        setNote(null);
      }
    });
  }

  function addDeliverable(t: WeeklyBriefTaskUpdateDTO) {
    const s = tasks[t.id];
    if (!s.newLabel.trim() || !s.newUrl.trim()) return;
    startTransition(async () => {
      await addWeeklyTaskDeliverable({ updateId: t.id, label: s.newLabel, url: s.newUrl });
      setTask(t.id, { newLabel: "", newUrl: "" });
      router.refresh();
    });
  }

  const disabled = locked || pending;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-lg font-bold text-ink">{team.workstreamTitle}</h2>
            <StatusBadge tone={statusTone(form.status)}>
              {form.status === "DRAFT" ? "Not submitted" : form.status}
            </StatusBadge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/operations/initiatives/${team.initiativeId}/teams/${team.workstreamId}/brief/${team.weekKey}`}
              className="text-sm font-semibold text-brand-700 no-underline hover:underline"
            >
              Full team presentation →
            </Link>
            {team.officerMeeting ? (
              <Link
                href={`/actions/meetings/${team.officerMeeting.id}`}
                className="text-sm font-semibold text-brand-700 no-underline hover:underline"
              >
                This week&apos;s meeting →
              </Link>
            ) : null}
          </div>
        </div>
        <p className="m-0 text-[12.5px] text-ink-muted">
          Your part of {team.workstreamTitle}&apos;s one combined weekly presentation — everyone on
          the team adds their piece here.
        </p>
      </header>

      {form.inputNeededCarried ? (
        <p className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Carried from last week — you asked for this and it wasn&apos;t resolved. Update it or
          clear it if you no longer need it.
        </p>
      ) : null}

      {issues.length > 0 ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <p className="m-0 font-semibold">Make these more specific before submitting:</p>
          <ul className="m-0 mt-1 list-disc pl-5">
            {issues.map((i, idx) => (
              <li key={`${i.field}-${i.taskUpdateId ?? "self"}-${idx}`}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Section 1 — Overall Objective & Deliverable */}
      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-bold text-ink">
          1 · Overall objective &amp; deliverable
        </legend>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Objective — the core goal of your work this cycle
          <textarea
            className={textareaClass}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Build the instructor onboarding system"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Deliverable — what it looks like when done
            <textarea
              className={`${textareaClass} ${hasIssue("personalDeliverable") ? errorRing : ""}`}
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              disabled={disabled}
              placeholder="e.g. Completed guide + checklist live in the portal (a thing, not a process)"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Target date
            <input
              type="date"
              className={inputClass}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      </fieldset>

      {/* Section 2 & 3 — This week's progress + next steps (per task) */}
      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-bold text-ink">
          2 · This week&apos;s progress &amp; 3 · next steps
        </legend>
        {form.taskUpdates.length === 0 ? (
          <p className="m-0 rounded-md border border-[var(--border)] bg-[var(--rail)] px-3 py-2 text-sm text-ink-muted">
            No tracked tasks are assigned to you on this team yet. Add what you did and your next
            step under Objective above, or create an Action Tracker task so it shows here next
            week.
          </p>
        ) : (
          form.taskUpdates.map((t) => {
            const s = tasks[t.id];
            return (
              <article key={t.id} className="grid gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-ink">{t.taskTitle}</strong>
                  <span className="text-xs text-ink-muted">
                    {t.liveStatus ?? "—"}
                    {t.deadlineISO ? ` · due ${t.deadlineISO.slice(0, 10)}` : ""}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Specifically what you did this week
                    <textarea
                      className={`${textareaClass} ${hasIssue("workCompleted", t.id) ? errorRing : ""}`}
                      value={s.workCompleted}
                      onChange={(e) => setTask(t.id, { workCompleted: e.target.value })}
                      disabled={disabled}
                      placeholder="Be specific — 'Cold-contacted 8 schools, booked 3 meetings', not 'worked on it'"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Outcome / impact
                    <textarea
                      className={`${textareaClass} ${hasIssue("currentResult", t.id) ? errorRing : ""}`}
                      value={s.currentResult}
                      onChange={(e) => setTask(t.id, { currentResult: e.target.value })}
                      disabled={disabled}
                      placeholder="What changed or what can now be shown"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-semibold text-ink">
                  Next step — what you&apos;ll show by next week
                  <textarea
                    className={`${textareaClass} ${hasIssue("nextAction", t.id) ? errorRing : ""}`}
                    value={s.nextAction}
                    onChange={(e) => setTask(t.id, { nextAction: e.target.value })}
                    disabled={disabled}
                    placeholder="A concrete deliverable, not a vague intention"
                  />
                </label>
                {t.carriedForward ? (
                  <p className="m-0 text-xs font-semibold text-amber-700">
                    Carried from last week — this was promised and isn&apos;t closed yet.
                  </p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Blocker (optional)
                    <textarea
                      className={textareaClass}
                      value={s.blockerNote}
                      onChange={(e) => setTask(t.id, { blockerNote: e.target.value })}
                      disabled={disabled}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Decision needed (optional)
                    <textarea
                      className={textareaClass}
                      value={s.decisionNeeded}
                      onChange={(e) => setTask(t.id, { decisionNeeded: e.target.value })}
                      disabled={disabled}
                    />
                  </label>
                </div>

                {/* Artifacts / deliverables to show */}
                <div className="rounded-md border border-[var(--border)] bg-[var(--rail)] p-3">
                  <p className="m-0 text-sm font-bold text-ink">Artifact you&apos;re showing</p>
                  {t.allDeliverables.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.allDeliverables.map((d) => (
                        <a
                          key={d.id}
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 no-underline"
                        >
                          Open {d.label}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 mt-1 text-xs text-ink-muted">
                      No artifact linked yet — add the doc, tracker, or screenshot you&apos;ll show.
                    </p>
                  )}
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                    <input
                      className={inputClass}
                      placeholder="Label"
                      value={s.newLabel}
                      onChange={(e) => setTask(t.id, { newLabel: e.target.value })}
                      disabled={disabled}
                    />
                    <input
                      className={inputClass}
                      placeholder="https://..."
                      value={s.newUrl}
                      onChange={(e) => setTask(t.id, { newUrl: e.target.value })}
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      onClick={() => addDeliverable(t)}
                      disabled={disabled || !s.newLabel.trim() || !s.newUrl.trim()}
                      className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </fieldset>

      {/* Section 4 — Input needed */}
      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-bold text-ink">4 · Input needed</legend>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          The specific decision or resource you need to move forward
          <textarea
            className={`${textareaClass} ${hasIssue("inputNeeded") ? errorRing : ""}`}
            value={inputNeeded}
            onChange={(e) => setInputNeeded(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Approve the onboarding guide structure before I finish sections 4-5"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Who from
            <input
              className={inputClass}
              value={inputFrom}
              onChange={(e) => setInputFrom(e.target.value)}
              disabled={disabled}
              placeholder="e.g. Brayden"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            By when
            <input
              type="date"
              className={inputClass}
              value={inputBy}
              onChange={(e) => setInputBy(e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      </fieldset>

      {note ? <p className="m-0 text-sm font-medium text-complete-700">{note}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={saveDraft}
          disabled={disabled}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitted ? "Re-submit" : "Submit my weekly impact"}
        </button>
        {locked ? (
          <span className="text-sm text-ink-muted">This week is finalized — locked for edits.</span>
        ) : null}
      </div>
    </section>
  );
}
