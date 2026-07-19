"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  submitAttendanceRosterAction,
  type AttendanceRosterFormState,
} from "@/lib/operational/workspace-actions";

type Student = { id: string; name: string | null; email?: string | null };
type ExistingRecord = { studentId: string; status: string; notes?: string | null; finalizedAt?: string | Date | null; updatedAt?: string | Date };

const STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
] as const;

const INITIAL_STATE: AttendanceRosterFormState = { status: "idle", message: "" };

function SubmitButtons({ canOverrideFinalized }: { canOverrideFinalized: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="submit"
        name="finalize"
        value=""
        disabled={pending}
        className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save draft"}
      </button>
      <button
        type="submit"
        name="finalize"
        value="on"
        disabled={pending}
        className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : canOverrideFinalized ? "Finalize (override)" : "Finalize attendance"}
      </button>
    </div>
  );
}

export function AttendanceRoster({
  classId,
  sessionId,
  students,
  existingRecords,
  canOverrideFinalized,
  loadedAt,
}: {
  classId: string;
  sessionId: string;
  students: Student[];
  existingRecords: ExistingRecord[];
  canOverrideFinalized: boolean;
  loadedAt: string;
}) {
  const existingByStudent = useMemo(() => new Map(existingRecords.map((r) => [r.studentId, r])), [existingRecords]);
  const sessionIsFinalized = existingRecords.length > 0 && existingRecords.every((r) => !!r.finalizedAt);
  const anyFinalized = existingRecords.some((r) => !!r.finalizedAt);

  const [entries, setEntries] = useState<Record<string, { status: string; notes: string }>>(() => {
    const initial: Record<string, { status: string; notes: string }> = {};
    for (const s of students) {
      const existing = existingByStudent.get(s.id);
      initial[s.id] = { status: existing?.status ?? "PRESENT", notes: existing?.notes ?? "" };
    }
    return initial;
  });

  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [pendingFinalizeValue, setPendingFinalizeValue] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const [state, formAction] = useActionState(submitAttendanceRosterAction, INITIAL_STATE);

  const locked = sessionIsFinalized && !unlocked;

  function setStatus(studentId: string, status: string) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
  }
  function setNotes(studentId: string, notes: string) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes } }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const wantsFinalize = submitter?.value === "on";
    if (wantsFinalize && !confirmingFinalize) {
      e.preventDefault();
      setPendingFinalizeValue("on");
      setConfirmingFinalize(true);
    }
  }

  const entriesJson = JSON.stringify(
    students.map((s) => ({ studentId: s.id, status: entries[s.id]?.status ?? "PRESENT", notes: entries[s.id]?.notes || undefined })),
  );

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      {locked && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900" role="status">
          Attendance is finalized for this session.
          {canOverrideFinalized && (
            <button
              type="button"
              className="ml-2 min-h-11 rounded-lg border border-emerald-400 px-3 py-1 font-semibold text-emerald-900 hover:bg-emerald-100"
              onClick={() => setUnlocked(true)}
            >
              Override to edit
            </button>
          )}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900" role="alert">
          <p>{state.message}</p>
          {state.missingStudents?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {state.missingStudents.map((m) => (
                <li key={m.studentId}>{m.name ?? m.studentId}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900" role="status">
          {state.message}
        </div>
      )}

      <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="entriesJson" value={entriesJson} />
        <input type="hidden" name="loadedAt" value={loadedAt} />

        <ul className="space-y-3">
          {students.map((s) => {
            const existing = existingByStudent.get(s.id);
            const rowFinalized = !!existing?.finalizedAt;
            const current = entries[s.id]?.status ?? "PRESENT";
            return (
              <li key={s.id} className="rounded-xl border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 sm:pr-4">
                  <p className="font-medium text-slate-900 truncate">{s.name ?? s.email ?? s.id}</p>
                  {rowFinalized && <p className="text-xs text-slate-500">Finalized</p>}
                </div>
                <div
                  role="radiogroup"
                  aria-label={`Attendance status for ${s.name ?? s.id}`}
                  className="flex flex-wrap gap-2 shrink-0"
                >
                  {STATUSES.map((opt) => {
                    const pressed = current === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={pressed}
                        disabled={locked}
                        onClick={() => setStatus(s.id, opt.value)}
                        className={
                          "min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 " +
                          (pressed ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50")
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  disabled={locked}
                  aria-label={`Note for ${s.name ?? s.id}`}
                  placeholder="Note (optional)"
                  value={entries[s.id]?.notes ?? ""}
                  onChange={(e) => setNotes(s.id, e.target.value)}
                  className="min-h-11 rounded-lg border px-3 py-2 text-sm sm:w-48 disabled:opacity-50"
                />
              </li>
            );
          })}
        </ul>

        {!locked && (
          <>
            {confirmingFinalize && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alertdialog" aria-label="Confirm finalize">
                <p>Finalizing locks these records{anyFinalized ? " (some are already finalized)" : ""}. Continue?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    name="finalize"
                    value={pendingFinalizeValue ?? "on"}
                    className="min-h-11 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Yes, finalize
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => setConfirmingFinalize(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <SubmitButtons canOverrideFinalized={canOverrideFinalized} />
          </>
        )}
      </form>
    </div>
  );
}

export type RosterSession = {
  id: string;
  label: string;
  isCancelled?: boolean;
  attendance: ExistingRecord[];
  complete: boolean;
};

/** Session picker + roster for the instructor attendance workspace: lists the
 * offering's sessions with a completeness indicator, and renders the roster
 * for whichever session is selected. */
export function SessionAttendancePanel({
  classId,
  students,
  sessions,
  canOverrideFinalized,
}: {
  classId: string;
  students: Student[];
  sessions: RosterSession[];
  canOverrideFinalized: boolean;
}) {
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally recompute loadedAt when the selected session changes
  const loadedAt = useMemo(() => new Date().toISOString(), [selectedId]);
  const selected = sessions.find((s) => s.id === selectedId);

  if (!sessions.length) {
    return <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">No sessions scheduled yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sessions">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === selectedId}
            onClick={() => setSelectedId(s.id)}
            className={
              "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium " +
              (s.id === selectedId ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-slate-300 text-slate-700 hover:bg-slate-50")
            }
          >
            {s.label} · {s.isCancelled ? "Cancelled" : s.complete ? "Complete" : "Incomplete"}
          </button>
        ))}
      </div>
      {selected && !selected.isCancelled && (
        <AttendanceRoster
          key={selected.id}
          classId={classId}
          sessionId={selected.id}
          students={students}
          existingRecords={selected.attendance}
          canOverrideFinalized={canOverrideFinalized}
          loadedAt={loadedAt}
        />
      )}
      {selected?.isCancelled && <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">This session is cancelled; attendance is not recorded.</p>}
    </div>
  );
}
