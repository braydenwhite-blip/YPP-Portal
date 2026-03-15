"use client";

import { useState, useTransition } from "react";
import {
  updateStudentProgress,
  markSessionComplete,
} from "@/lib/passion-lab-actions";

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionTopic = {
  topic?: string;
  activities?: string;
  materials?: string;
};

type Student = {
  id: string;
  name: string;
  email: string;
};

type ProgressRecord = {
  id: string;
  programId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  sessionIndex: number;
  status: string;
  artifactUrl: string | null;
  artifactNotes: string | null;
  instructorNotes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  programId: string;
  programName: string;
  sessionTopics: SessionTopic[];
  students: Student[];
  progressRecords: ProgressRecord[];
};

type SelectedCell = {
  studentId: string;
  sessionIndex: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "#f3f4f6",
  IN_PROGRESS: "#fffbeb",
  COMPLETED: "#dcfce7",
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

function getProgressKey(studentId: string, sessionIndex: number) {
  return `${studentId}:${sessionIndex}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PassionLabProgressClient({
  programId,
  programName,
  sessionTopics,
  students,
  progressRecords: initialRecords,
}: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Detail panel form state
  const [detailArtifactUrl, setDetailArtifactUrl] = useState("");
  const [detailArtifactNotes, setDetailArtifactNotes] = useState("");
  const [detailInstructorNotes, setDetailInstructorNotes] = useState("");
  const [detailStatus, setDetailStatus] = useState("NOT_STARTED");

  // Build lookup map
  const recordMap = new Map<string, ProgressRecord>();
  for (const r of records) {
    recordMap.set(getProgressKey(r.studentId, r.sessionIndex), r);
  }

  const sessionCount = sessionTopics.length || 1;

  // ─── Stats ───────────────────────────────────────────────────────────────

  const totalCells = students.length * sessionCount;
  const completedCells = records.filter((r) => r.status === "COMPLETED").length;
  const overallPercent = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;

  const sessionCompletionRates = Array.from({ length: sessionCount }, (_, i) => {
    if (students.length === 0) return 0;
    const completed = records.filter(
      (r) => r.sessionIndex === i && r.status === "COMPLETED",
    ).length;
    return Math.round((completed / students.length) * 100);
  });

  // ─── Cell click handler ──────────────────────────────────────────────────

  function handleCellClick(studentId: string, sessionIndex: number) {
    const key = getProgressKey(studentId, sessionIndex);
    const record = recordMap.get(key);

    if (
      selectedCell &&
      selectedCell.studentId === studentId &&
      selectedCell.sessionIndex === sessionIndex
    ) {
      setSelectedCell(null);
      return;
    }

    setSelectedCell({ studentId, sessionIndex });
    setDetailArtifactUrl(record?.artifactUrl ?? "");
    setDetailArtifactNotes(record?.artifactNotes ?? "");
    setDetailInstructorNotes(record?.instructorNotes ?? "");
    setDetailStatus(record?.status ?? "NOT_STARTED");
    setError(null);
  }

  // ─── Save handler ────────────────────────────────────────────────────────

  function handleSave() {
    if (!selectedCell) return;
    setError(null);

    startTransition(async () => {
      try {
        await updateStudentProgress(
          programId,
          selectedCell.studentId,
          selectedCell.sessionIndex,
          {
            status: detailStatus,
            artifactUrl: detailArtifactUrl || undefined,
            artifactNotes: detailArtifactNotes || undefined,
            instructorNotes: detailInstructorNotes || undefined,
          },
        );

        // Optimistic update
        const key = getProgressKey(selectedCell.studentId, selectedCell.sessionIndex);
        const existing = recordMap.get(key);
        const updated: ProgressRecord = {
          id: existing?.id ?? "temp",
          programId,
          studentId: selectedCell.studentId,
          studentName: students.find((s) => s.id === selectedCell.studentId)?.name ?? null,
          studentEmail: students.find((s) => s.id === selectedCell.studentId)?.email ?? null,
          sessionIndex: selectedCell.sessionIndex,
          status: detailStatus,
          artifactUrl: detailArtifactUrl || null,
          artifactNotes: detailArtifactNotes || null,
          instructorNotes: detailInstructorNotes || null,
          completedAt: detailStatus === "COMPLETED" ? new Date().toISOString() : (existing?.completedAt ?? null),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setRecords((prev) => {
          const filtered = prev.filter(
            (r) => !(r.studentId === selectedCell.studentId && r.sessionIndex === selectedCell.sessionIndex),
          );
          return [...filtered, updated];
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  // ─── Mark complete handler ───────────────────────────────────────────────

  function handleMarkComplete() {
    if (!selectedCell) return;
    setError(null);

    startTransition(async () => {
      try {
        await markSessionComplete(
          programId,
          selectedCell.studentId,
          selectedCell.sessionIndex,
        );

        setDetailStatus("COMPLETED");

        const key = getProgressKey(selectedCell.studentId, selectedCell.sessionIndex);
        const existing = recordMap.get(key);
        const updated: ProgressRecord = {
          id: existing?.id ?? "temp",
          programId,
          studentId: selectedCell.studentId,
          studentName: students.find((s) => s.id === selectedCell.studentId)?.name ?? null,
          studentEmail: students.find((s) => s.id === selectedCell.studentId)?.email ?? null,
          sessionIndex: selectedCell.sessionIndex,
          status: "COMPLETED",
          artifactUrl: (existing?.artifactUrl ?? detailArtifactUrl) || null,
          artifactNotes: (existing?.artifactNotes ?? detailArtifactNotes) || null,
          instructorNotes: (existing?.instructorNotes ?? detailInstructorNotes) || null,
          completedAt: new Date().toISOString(),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setRecords((prev) => {
          const filtered = prev.filter(
            (r) => !(r.studentId === selectedCell.studentId && r.sessionIndex === selectedCell.sessionIndex),
          );
          return [...filtered, updated];
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to mark complete");
      }
    });
  }

  // ─── Selected record for detail panel ────────────────────────────────────

  const selectedStudent = selectedCell
    ? students.find((s) => s.id === selectedCell.studentId)
    : null;
  const selectedSessionTopic = selectedCell
    ? sessionTopics[selectedCell.sessionIndex]
    : null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <a
            href="/instructor/passion-lab-builder"
            style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}
          >
            &larr; Back to Builder
          </a>
        </div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Student Progress
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>{programName}</p>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div
          className="card"
          style={{
            padding: 16,
            textAlign: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {students.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Total Students</div>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            textAlign: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {sessionCount}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Sessions</div>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            textAlign: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {overallPercent}%
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Overall Progress</div>
        </div>
      </div>

      {/* Per-session completion rates */}
      {sessionCount > 1 && (
        <div
          className="card"
          style={{
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Session Completion Rates
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sessionCompletionRates.map((rate, i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 80px",
                  textAlign: "center",
                  padding: "8px 4px",
                  background: rate === 100 ? "#dcfce7" : rate > 0 ? "#fffbeb" : "#f3f4f6",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 16 }}>{rate}%</div>
                <div style={{ color: "var(--muted)", marginTop: 2 }}>
                  S{i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {students.length === 0 && (
        <div
          className="card"
          style={{
            padding: 24,
            textAlign: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--muted)",
          }}
        >
          No students are enrolled in this Passion Lab yet.
        </div>
      )}

      {/* Progress Grid */}
      {students.length > 0 && (
        <div
          className="card"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--border)",
                    fontWeight: 600,
                    position: "sticky",
                    left: 0,
                    background: "white",
                    minWidth: 160,
                  }}
                >
                  Student
                </th>
                {Array.from({ length: sessionCount }, (_, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "center",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 600,
                      minWidth: 100,
                    }}
                    title={sessionTopics[i]?.topic ?? `Session ${i + 1}`}
                  >
                    {sessionTopics[i]?.topic
                      ? sessionTopics[i].topic!.length > 16
                        ? sessionTopics[i].topic!.slice(0, 14) + "..."
                        : sessionTopics[i].topic
                      : `Session ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      position: "sticky",
                      left: 0,
                      background: "white",
                      fontWeight: 500,
                    }}
                  >
                    <div>{student.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {student.email}
                    </div>
                  </td>
                  {Array.from({ length: sessionCount }, (_, i) => {
                    const key = getProgressKey(student.id, i);
                    const record = recordMap.get(key);
                    const status = record?.status ?? "NOT_STARTED";
                    const isSelected =
                      selectedCell?.studentId === student.id &&
                      selectedCell?.sessionIndex === i;

                    return (
                      <td
                        key={i}
                        onClick={() => handleCellClick(student.id, i)}
                        style={{
                          padding: "8px",
                          borderBottom: "1px solid var(--border)",
                          textAlign: "center",
                          background: STATUS_COLORS[status] ?? "#f3f4f6",
                          cursor: "pointer",
                          outline: isSelected
                            ? "2px solid var(--ypp-purple)"
                            : "none",
                          outlineOffset: -2,
                          transition: "background 0.15s",
                        }}
                      >
                        <span style={{ fontSize: 12 }}>
                          {STATUS_LABELS[status] ?? status}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selectedCell && selectedStudent && (
        <div
          className="card"
          style={{
            padding: 20,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {selectedStudent.name} &mdash;{" "}
                {selectedSessionTopic?.topic ?? `Session ${selectedCell.sessionIndex + 1}`}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {selectedStudent.email}
              </div>
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "var(--muted)",
                padding: "0 4px",
              }}
            >
              &times;
            </button>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Status selector */}
          <div>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Status
            </label>
            <select
              value={detailStatus}
              onChange={(e) => setDetailStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
              }}
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Artifact URL */}
          <div>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Artifact URL
            </label>
            <input
              type="url"
              value={detailArtifactUrl}
              onChange={(e) => setDetailArtifactUrl(e.target.value)}
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Artifact Notes */}
          <div>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Artifact Notes
            </label>
            <textarea
              value={detailArtifactNotes}
              onChange={(e) => setDetailArtifactNotes(e.target.value)}
              placeholder="Notes about the student's artifact..."
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Instructor Notes */}
          <div>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Instructor Notes
            </label>
            <textarea
              value={detailInstructorNotes}
              onChange={(e) => setDetailInstructorNotes(e.target.value)}
              placeholder="Private notes about this student's progress..."
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={isPending}
              style={{
                padding: "8px 20px",
                background: "var(--ypp-purple)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>

            {detailStatus !== "COMPLETED" && (
              <button
                onClick={handleMarkComplete}
                disabled={isPending}
                style={{
                  padding: "8px 20px",
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? "Saving..." : "Mark Complete"}
              </button>
            )}

            <button
              onClick={() => setSelectedCell(null)}
              disabled={isPending}
              style={{
                padding: "8px 20px",
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
