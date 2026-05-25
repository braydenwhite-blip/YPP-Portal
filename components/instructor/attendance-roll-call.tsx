"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { bulkRecordAttendance } from "@/lib/attendance-actions";

type Status = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

const STATUSES: { value: Status; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

const STATUS_DOT: Record<Status, string> = {
  PRESENT: "var(--success-color)",
  LATE: "var(--warning-color)",
  ABSENT: "var(--error-color)",
  EXCUSED: "#2563eb",
};

export type RollCallStudent = {
  userId: string;
  name: string;
  email: string;
  status: Status;
  notes: string;
};

function signature(rows: RollCallStudent[]): string {
  return JSON.stringify(
    rows.map((r) => ({ u: r.userId, s: r.status, n: r.notes })),
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="button primary small"
      disabled={pending || !dirty}
    >
      {pending ? "Saving…" : dirty ? "Save attendance" : "All saved ✓"}
    </button>
  );
}

/**
 * Batched roll-call: an instructor sets every student's status and notes in
 * one screen and saves the whole class in a single submit (`bulkRecordAttendance`).
 * Replaces the previous one-form-per-student layout.
 */
export function AttendanceRollCall({
  sessionId,
  initialStudents,
}: {
  sessionId: string;
  initialStudents: RollCallStudent[];
}) {
  const [rows, setRows] = useState<RollCallStudent[]>(initialStudents);

  const initialSignature = useMemo(
    () => signature(initialStudents),
    [initialStudents],
  );
  const dirty = signature(rows) !== initialSignature;

  // Warn before navigating away with unsaved roll-call edits.
  useEffect(() => {
    if (!dirty) return;
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const counts = useMemo(() => {
    const tally: Record<Status, number> = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
    };
    for (const row of rows) tally[row.status] += 1;
    return tally;
  }, [rows]);

  const payload = JSON.stringify(
    rows.map((r) => ({ userId: r.userId, status: r.status, notes: r.notes })),
  );

  function setStatus(userId: string, status: Status) {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, status } : r)),
    );
  }

  function setNotes(userId: string, notes: string) {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, notes } : r)),
    );
  }

  function markAll(status: Status) {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  }

  return (
    <form action={bulkRecordAttendance}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="records" value={payload} />

      <div className="rollcall-toolbar">
        <div className="rollcall-summary" aria-label="Attendance summary">
          {STATUSES.map((s) => (
            <span key={s.value} className="rollcall-summary-item">
              <span
                className="rollcall-dot"
                style={{ background: STATUS_DOT[s.value] }}
                aria-hidden="true"
              />
              {counts[s.value]} {s.label}
            </span>
          ))}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button secondary small"
            onClick={() => markAll("PRESENT")}
          >
            Mark all present
          </button>
          <SaveButton dirty={dirty} />
        </div>
      </div>

      {dirty ? (
        <p className="rollcall-dirty-hint">You have unsaved changes.</p>
      ) : null}

      <div className="rollcall-list">
        {rows.map((row) => (
          <div className="rollcall-row" key={row.userId}>
            <div className="rollcall-row-name">
              <strong>{row.name}</strong>
              <span>{row.email}</span>
            </div>
            <div
              className="rollcall-status-group"
              role="group"
              aria-label={`Attendance status for ${row.name}`}
            >
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  data-status={s.value}
                  className={`rollcall-status-btn${
                    row.status === s.value ? " active" : ""
                  }`}
                  aria-pressed={row.status === s.value}
                  onClick={() => setStatus(row.userId, s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              className="rollcall-notes"
              type="text"
              placeholder="Add a note (optional)"
              value={row.notes}
              onChange={(event) => setNotes(row.userId, event.target.value)}
              aria-label={`Note for ${row.name}`}
            />
          </div>
        ))}
      </div>
    </form>
  );
}
