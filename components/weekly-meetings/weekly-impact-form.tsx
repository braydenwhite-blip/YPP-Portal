"use client";

/**
 * Weekly Impact form — hybrid of the uploaded v2 design: one flexible add-row
 * table (Type / What·Goal / Evidence·Next Action / Due / Status) plus a separate
 * "Input / help needed" box. Each team/chapter the person is on is a tab. Rows
 * carry curation toggles (Present / Decision / Board) that surface them in the
 * meeting's Impact Presentations table.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, StatusBadge, ToastV2 } from "@/components/ui-v2";
import type { ImpactEntryDTO, ImpactRowDTO, MyWeeklyImpact } from "@/lib/weekly-meetings/weekly-impact";
import type { ContributionSuggestion } from "@/lib/weekly-meetings/contribution-types";
import {
  addImpactRow,
  addImpactRowFromContribution,
  deleteImpactRow,
  reopenImpactEntry,
  saveImpactEntry,
  submitImpactEntry,
  updateImpactRow,
} from "@/lib/weekly-meetings/weekly-impact-actions";

const ROW_STATUS_LABELS: Record<ImpactRowDTO["rowStatus"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

export function WeeklyImpactForm({
  data,
  userName,
  contributions = [],
}: {
  data: MyWeeklyImpact;
  userName: string;
  contributions?: ContributionSuggestion[];
}) {
  const [activeId, setActiveId] = useState(data.entries[0]?.id ?? "");
  const active = data.entries.find((e) => e.id === activeId) ?? data.entries[0];

  if (!data.entries.length) {
    return (
      <div className="rounded-[14px] border border-line-card bg-surface p-8 text-center text-[14px] text-ink-muted shadow-card">
        {data.hasScope ? (
          <>
            Nothing logged for <span className="font-semibold text-ink">{data.weekLabel}</span> yet.
            {data.weekState === "future"
              ? " This week hasn’t started — switch to This week to log your impact."
              : " Switch to This week to start, or pick a recent week to back-fill."}
          </>
        ) : (
          <>
            You&rsquo;re not on a team yet. Ask an admin to add you to a team in
            <span className="font-semibold text-ink"> Admin → Teams</span>, then your Weekly Impact form
            will appear here.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.entries.length > 1 && (
        <div className="seg-tabs w-fit max-w-full">
          {data.entries.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`seg-tab${e.id === active?.id ? " active" : ""}`}
              onClick={() => setActiveId(e.id)}
            >
              {e.scopeName}
            </button>
          ))}
        </div>
      )}
      {active && (
        <EntryEditor
          key={active.id}
          entry={active}
          userName={userName}
          weekLabel={data.weekLabel}
          contributions={contributions}
        />
      )}
    </div>
  );
}

function EntryEditor({
  entry,
  userName,
  weekLabel,
  contributions,
}: {
  entry: ImpactEntryDTO;
  userName: string;
  weekLabel: string;
  contributions: ContributionSuggestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inputNeeded, setInputNeeded] = useState(entry.inputNeeded ?? "");
  const [toast, setToast] = useState<{ tone: "success" | "danger"; msg: string } | null>(null);
  const submitted = entry.status === "SUBMITTED";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function run(fn: () => Promise<unknown>, okMsg?: string) {
    startTransition(async () => {
      try {
        const res = (await fn()) as { ok?: boolean; error?: string } | undefined;
        if (res && res.ok === false) {
          setToast({ tone: "danger", msg: res.error ?? "Something went wrong." });
          return;
        }
        if (okMsg) setToast({ tone: "success", msg: okMsg });
        router.refresh();
      } catch {
        setToast({ tone: "danger", msg: "Something went wrong. Try again." });
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
      {/* Doc header */}
      <div className="border-b-2 border-ink px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-[22px] font-bold leading-tight text-ink">
              Weekly Impact — <span className="text-brand-600">{userName}</span>
            </h2>
            <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
              {entry.scopeName} · {weekLabel}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusBadge tone={submitted ? "success" : "warning"}>
              {submitted ? "Submitted" : "Draft"}
            </StatusBadge>
            {submitted ? (
              <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => reopenImpactEntry({ entryId: entry.id }))}>
                Edit
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={pending}
                onClick={() => run(() => submitImpactEntry({ entryId: entry.id }), "Submitted ✓")}
              >
                Submit →
              </Button>
            )}
          </div>
        </div>
        <p className="m-0 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-muted">
          <span><b className="font-semibold text-ink">Status:</b> Not started · In progress · Blocked · Done</span>
          <span><b className="font-semibold text-ink">Present:</b> show at the meeting · <b className="font-semibold text-ink">Decision:</b> needs a call · <b className="font-semibold text-ink">Board:</b> roll up to the board</span>
        </p>
      </div>

      {/* Where this entry's flagged rows go */}
      <MeetingLinkBanner entry={entry} submitted={submitted} />

      {/* Pull in mentorship + reviews done this week */}
      {!submitted && contributions.length > 0 && (
        <ContributionsPanel entryId={entry.id} contributions={contributions} pending={pending} onRun={run} />
      )}

      {/* Table */}
      <div className="overflow-x-auto px-6 py-5">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-ink-muted">
              <th className="w-28 px-2 py-2 font-semibold">Type</th>
              <th className="px-2 py-2 font-semibold">What / Goal</th>
              <th className="px-2 py-2 font-semibold">Evidence / Next action</th>
              <th className="w-32 px-2 py-2 font-semibold">Due</th>
              <th className="w-32 px-2 py-2 font-semibold">Status</th>
              <th className="w-40 px-2 py-2 text-center font-semibold">Present · Dec · Board</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {entry.rows.map((row) => (
              <RowEditor key={row.id} row={row} disabled={submitted || pending} onRun={run} />
            ))}
            {entry.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-[13px] text-ink-muted">
                  No rows yet — add your first update below.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!submitted && (
          <button
            type="button"
            className="mt-3 text-[12.5px] font-semibold text-brand-600 hover:opacity-70 disabled:opacity-50"
            disabled={pending}
            onClick={() => run(() => addImpactRow({ entryId: entry.id }))}
          >
            + Add row
          </button>
        )}
      </div>

      {/* Input / help needed box */}
      <div className="border-t border-line-soft px-6 py-5">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Input / help needed
        </label>
        <textarea
          className={`${inputCls} min-h-[64px] resize-y`}
          placeholder="Anything you need from the team or officers this week — questions, blockers, decisions to raise…"
          value={inputNeeded}
          disabled={submitted || pending}
          onChange={(e) => setInputNeeded(e.target.value)}
          onBlur={() => {
            if (inputNeeded !== (entry.inputNeeded ?? "")) {
              run(() => saveImpactEntry({ entryId: entry.id, inputNeeded }));
            }
          }}
        />
        {!submitted && (
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => run(() => saveImpactEntry({ entryId: entry.id, inputNeeded }), "Saved")}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={pending}
              onClick={() => run(() => submitImpactEntry({ entryId: entry.id }), "Submitted ✓")}
            >
              Submit →
            </Button>
          </div>
        )}
      </div>

      {toast && (
        <ToastV2 open tone={toast.tone}>
          {toast.msg}
        </ToastV2>
      )}
    </div>
  );
}

const CONTRIBUTION_TONE: Record<ContributionSuggestion["kind"], string> = {
  mentorship_session: "bg-teal-50 text-teal-700",
  mentor_review: "bg-brand-50 text-brand-700",
  quarterly_review: "bg-info-100 text-info-700",
};

/**
 * Surfaces the mentorship sessions + reviews the person did this week and lets
 * them drop any one into the form as a pre-filled "Done" row — so a week's work
 * across the portal lands in one Weekly Impact, then flows to the meeting.
 */
function ContributionsPanel({
  entryId,
  contributions,
  pending,
  onRun,
}: {
  entryId: string;
  contributions: ContributionSuggestion[];
  pending: boolean;
  onRun: (fn: () => Promise<unknown>, okMsg?: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [added, setAdded] = useState<Set<string>>(new Set());

  function add(c: ContributionSuggestion) {
    setAdded((prev) => new Set(prev).add(c.key));
    onRun(
      () =>
        addImpactRowFromContribution({
          entryId,
          type: c.type,
          whatGoal: c.whatGoal,
          evidenceNext: c.evidenceNext,
        }),
      "Added to your impact ✓"
    );
  }

  return (
    <div className="border-b border-line-soft bg-surface-soft px-6 py-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand-700">
          Your week across the portal · {contributions.length}
        </span>
        <span className="text-[12px] font-semibold text-brand-600">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="m-0 text-[12px] text-ink-muted">
            Mentorship and reviews you completed this week — add any as a row.
          </p>
          {contributions.map((c) => {
            const isAdded = added.has(c.key);
            return (
              <div
                key={c.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft bg-surface px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] ${CONTRIBUTION_TONE[c.kind]}`}
                  >
                    {c.kindLabel}
                  </span>
                  <span className="truncate text-[13px] font-medium text-ink">{c.whatGoal}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending || isAdded}
                  onClick={() => add(c)}
                >
                  {isAdded ? "Added ✓" : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtMeetingWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Closes the loop for the contributor: shows how many rows are flagged to
 * present and the live impact meeting they will surface in (read-only — the
 * runner itself is officer-only).
 */
function MeetingLinkBanner({ entry, submitted }: { entry: ImpactEntryDTO; submitted: boolean }) {
  const { presentingCount, meeting } = entry;
  return (
    <div className="border-b border-line-soft bg-surface-soft px-6 py-3 text-[12.5px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-muted">
          <b className="font-semibold text-ink">{presentingCount}</b> row{presentingCount === 1 ? "" : "s"} flagged to
          present
        </span>
        {meeting ? (
          <span className="text-ink-muted">
            {submitted ? "Presenting at " : "Will present at "}
            <b className="font-semibold text-ink">{meeting.title}</b> · {fmtMeetingWhen(meeting.scheduledISO)}
            {meeting.status === "IN_PROGRESS" ? " (in progress)" : ""}
          </span>
        ) : (
          <span className="text-ink-muted">No impact meeting scheduled for this week yet.</span>
        )}
      </div>
      {meeting && !submitted && presentingCount > 0 ? (
        <p className="m-0 mt-1 text-[11.5px] font-medium text-progress-700">
          Submit this form so your flagged rows reach the meeting.
        </p>
      ) : null}
    </div>
  );
}

function RowEditor({
  row,
  disabled,
  onRun,
}: {
  row: ImpactRowDTO;
  disabled: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const [draft, setDraft] = useState(row);

  function patch(p: Partial<ImpactRowDTO>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function commit(p: Record<string, unknown>) {
    onRun(() => updateImpactRow({ rowId: row.id, ...p }));
  }

  return (
    <tr className="border-b border-line-soft align-top">
      <td className="px-2 py-2">
        <input
          className={inputCls}
          placeholder="Type…"
          value={draft.type ?? ""}
          disabled={disabled}
          onChange={(e) => patch({ type: e.target.value })}
          onBlur={() => draft.type !== row.type && commit({ type: draft.type })}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={inputCls}
          placeholder="What you did / your goal"
          value={draft.whatGoal ?? ""}
          disabled={disabled}
          onChange={(e) => patch({ whatGoal: e.target.value })}
          onBlur={() => draft.whatGoal !== row.whatGoal && commit({ whatGoal: draft.whatGoal })}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={inputCls}
          placeholder="Evidence / link / next action"
          value={draft.evidenceNext ?? ""}
          disabled={disabled}
          onChange={(e) => patch({ evidenceNext: e.target.value })}
          onBlur={() => draft.evidenceNext !== row.evidenceNext && commit({ evidenceNext: draft.evidenceNext })}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          className={inputCls}
          value={draft.due ?? ""}
          disabled={disabled}
          onChange={(e) => {
            patch({ due: e.target.value || null });
            commit({ due: e.target.value || "" });
          }}
        />
      </td>
      <td className="px-2 py-2">
        <select
          className={inputCls}
          value={draft.rowStatus}
          disabled={disabled}
          onChange={(e) => {
            const rowStatus = e.target.value as ImpactRowDTO["rowStatus"];
            patch({ rowStatus });
            commit({ rowStatus });
          }}
        >
          {Object.entries(ROW_STATUS_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-3 pt-1.5">
          <Flag label="P" title="Present at the meeting" checked={draft.presentToMeeting} disabled={disabled}
            onChange={(v) => { patch({ presentToMeeting: v }); commit({ presentToMeeting: v }); }} />
          <Flag label="D" title="Decision needed" checked={draft.decisionNeeded} disabled={disabled}
            onChange={(v) => { patch({ decisionNeeded: v }); commit({ decisionNeeded: v }); }} />
          <Flag label="B" title="Send to board" checked={draft.sendToBoard} disabled={disabled}
            onChange={(v) => { patch({ sendToBoard: v }); commit({ sendToBoard: v }); }} />
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        {!disabled && (
          <button
            type="button"
            title="Remove row"
            className="text-ink-muted hover:text-danger-700"
            onClick={() => onRun(() => deleteImpactRow({ rowId: row.id }))}
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

function Flag({
  label,
  title,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  title: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label title={title} className="flex cursor-pointer flex-col items-center gap-0.5">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-brand-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[9px] font-semibold text-ink-muted">{label}</span>
    </label>
  );
}
