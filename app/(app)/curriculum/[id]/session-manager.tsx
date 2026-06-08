"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClassSession, recordClassAttendance } from "@/lib/class-management-actions";

interface SessionData {
  id: string;
  sessionNumber: number;
  topic: string;
  description: string;
  materialsUrl: string;
  notesUrl: string;
  recordingUrl: string;
  isCancelled: boolean;
  cancelReason: string;
}

interface Student {
  id: string;
  name: string;
}

interface SessionManagerProps {
  session: SessionData;
  offeringId: string;
  enrolledStudents?: Student[];
}

// Must match the AttendanceStatus enum (PRESENT | ABSENT | LATE | EXCUSED).
const ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "Present", color: "#16a34a" },
  { value: "LATE", label: "Late", color: "#d97706" },
  { value: "ABSENT", label: "Absent", color: "#ef4444" },
  { value: "EXCUSED", label: "Excused", color: "#6b7280" },
] as const;

export function SessionManager({ session, offeringId, enrolledStudents }: SessionManagerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "attendance">("details");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [topic, setTopic] = useState(session.topic);
  const [description, setDescription] = useState(session.description);
  const [materialsUrl, setMaterialsUrl] = useState(session.materialsUrl);
  const [notesUrl, setNotesUrl] = useState(session.notesUrl);
  const [recordingUrl, setRecordingUrl] = useState(session.recordingUrl);

  // Attendance state
  const [attendance, setAttendance] = useState<Record<string, string>>({});

  function handleSaveDetails() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", session.id);
        fd.set("topic", topic);
        fd.set("description", description);
        fd.set("materialsUrl", materialsUrl);
        fd.set("notesUrl", notesUrl);
        fd.set("recordingUrl", recordingUrl);
        await updateClassSession(fd);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function markAll(status: string) {
    const next: Record<string, string> = {};
    for (const student of enrolledStudents ?? []) next[student.id] = status;
    setAttendance(next);
  }

  function handleSaveAttendance() {
    setError(null);
    startTransition(async () => {
      try {
        for (const [studentId, status] of Object.entries(attendance)) {
          const fd = new FormData();
          fd.set("sessionId", session.id);
          fd.set("studentId", studentId);
          fd.set("status", status);
          await recordClassAttendance(fd);
        }
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save attendance");
      }
    });
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontSize: 12,
          color: "var(--ypp-purple)",
          background: "none",
          border: "1px solid var(--ypp-purple)",
          borderRadius: 6,
          padding: "3px 10px",
          cursor: "pointer",
        }}
      >
        {isOpen ? "▲ Close" : "⚙ Manage Session"}
      </button>

      {isOpen && (
        <div style={{
          marginTop: 8,
          padding: 16,
          background: "var(--surface, #f9fafb)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setActiveTab("details")}
              className={`button ${activeTab === "details" ? "primary" : "secondary"}`}
              style={{ fontSize: 12 }}
            >
              Session Details
            </button>
            {enrolledStudents && enrolledStudents.length > 0 && (
              <button
                onClick={() => setActiveTab("attendance")}
                className={`button ${activeTab === "attendance" ? "primary" : "secondary"}`}
                style={{ fontSize: 12 }}
              >
                Attendance
              </button>
            )}
          </div>

          {activeTab === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Topic</label>
                <input
                  className="input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Description</label>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Materials URL</label>
                <input
                  className="input"
                  type="url"
                  value={materialsUrl}
                  onChange={(e) => setMaterialsUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Notes URL</label>
                <input
                  className="input"
                  type="url"
                  value={notesUrl}
                  onChange={(e) => setNotesUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Recording URL</label>
                <input
                  className="input"
                  type="url"
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>
              <button
                className="button primary"
                onClick={handleSaveDetails}
                disabled={isPending}
                style={{ fontSize: 13, alignSelf: "flex-start" }}
              >
                {isPending ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
              </button>
            </div>
          )}

          {activeTab === "attendance" && enrolledStudents && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Mark attendance for Session {session.sessionNumber}
                  {" · "}
                  <strong>{Object.keys(attendance).length}</strong>/{enrolledStudents.length} marked
                </div>
                <button
                  type="button"
                  onClick={() => markAll("PRESENT")}
                  className="button secondary"
                  style={{ fontSize: 11, padding: "3px 10px" }}
                >
                  Mark all present
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {enrolledStudents.map((student) => (
                  <div key={student.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                    <span style={{ flex: 1, minWidth: 120, fontWeight: 500 }}>{student.name}</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {ATTENDANCE_OPTIONS.map((option) => {
                        const active = attendance[student.id] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAttendance((prev) => ({ ...prev, [student.id]: option.value }))}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 6,
                              cursor: "pointer",
                              border: `1px solid ${active ? option.color : "var(--border)"}`,
                              background: active ? option.color : "transparent",
                              color: active ? "#fff" : option.color,
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="button primary"
                onClick={handleSaveAttendance}
                disabled={isPending || Object.keys(attendance).length === 0}
                style={{ fontSize: 13, marginTop: 12 }}
              >
                {isPending ? "Saving…" : saved ? "✓ Saved" : "Save Attendance"}
              </button>
            </div>
          )}

          {error && (
            <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
