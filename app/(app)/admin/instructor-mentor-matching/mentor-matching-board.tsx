"use client";

import { useState, useTransition } from "react";
import type { MentorSlot, UnmatchedMentee } from "@/lib/instructor-ops-actions";
import { assignMentorToInstructor } from "@/lib/instructor-ops-actions";
import Link from "next/link";

interface Props {
  mentors: MentorSlot[];
  unmatched: UnmatchedMentee[];
}

function CapacityBar({ filled, max }: { filled: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((filled / max) * 100)) : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 75 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3 }}>
        <div
          style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .2s" }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 40 }}>
        {filled}/{max}
      </span>
    </div>
  );
}

function MenteeCard({
  mentee,
  dragging,
  onDragStart,
}: {
  mentee: UnmatchedMentee;
  dragging: boolean;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: dragging ? "#f5f3ff" : "#fff",
        cursor: "grab",
        opacity: dragging ? 0.5 : 1,
        transition: "box-shadow .15s",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{mentee.name}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{mentee.chapterName ?? "No chapter"}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: mentee.daysSinceStage > 30 ? "#dc2626" : "var(--muted)" }}>
        {mentee.daysSinceStage}d without mentor
      </div>
    </div>
  );
}

export default function MentorMatchingBoard({ mentors: initialMentors, unmatched: initialUnmatched }: Props) {
  const [mentors, setMentors] = useState<MentorSlot[]>(initialMentors);
  const [unmatched, setUnmatched] = useState<UnmatchedMentee[]>(initialUnmatched);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchMentor, setSearchMentor] = useState("");

  const filteredUnmatched = unmatched.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.chapterName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const filteredMentors = mentors.filter(
    (m) =>
      !searchMentor ||
      m.mentorName.toLowerCase().includes(searchMentor.toLowerCase()) ||
      (m.chapterName ?? "").toLowerCase().includes(searchMentor.toLowerCase()),
  );

  function handleDragStart(userId: string) {
    setDraggingId(userId);
  }

  function handleDragOver(e: React.DragEvent, mentorId: string) {
    e.preventDefault();
    setDraggingOver(mentorId);
  }

  function handleDragLeave() {
    setDraggingOver(null);
  }

  function handleDrop(e: React.DragEvent, mentorId: string) {
    e.preventDefault();
    setDraggingOver(null);
    if (!draggingId) return;

    const mentor = mentors.find((m) => m.mentorId === mentorId);
    if (!mentor || mentor.availableSlots <= 0) {
      setError(`${mentor?.mentorName ?? "This mentor"} has no available slots.`);
      setDraggingId(null);
      return;
    }

    const menteeId = draggingId;
    const mentee = unmatched.find((u) => u.userId === menteeId);
    if (!mentee) { setDraggingId(null); return; }

    // Optimistic update
    setUnmatched((prev) => prev.filter((u) => u.userId !== menteeId));
    setMentors((prev) =>
      prev.map((m) =>
        m.mentorId === mentorId
          ? { ...m, currentMenteeCount: m.currentMenteeCount + 1, availableSlots: m.availableSlots - 1 }
          : m,
      ),
    );
    setDraggingId(null);
    setError(null);

    startTransition(() => {
      assignMentorToInstructor(menteeId, mentorId).catch((err) => {
        setError(String(err));
        // Rollback
        setUnmatched((prev) => [mentee, ...prev]);
        setMentors((prev) =>
          prev.map((m) =>
            m.mentorId === mentorId
              ? { ...m, currentMenteeCount: m.currentMenteeCount - 1, availableSlots: m.availableSlots + 1 }
              : m,
          ),
        );
      });
    });
  }

  function handleManualAssign(menteeId: string, mentorId: string) {
    const mentor = mentors.find((m) => m.mentorId === mentorId);
    const mentee = unmatched.find((u) => u.userId === menteeId);
    if (!mentor || !mentee) return;
    if (mentor.availableSlots <= 0) {
      setError(`${mentor.mentorName} has no available slots.`);
      return;
    }

    setUnmatched((prev) => prev.filter((u) => u.userId !== menteeId));
    setMentors((prev) =>
      prev.map((m) =>
        m.mentorId === mentorId
          ? { ...m, currentMenteeCount: m.currentMenteeCount + 1, availableSlots: m.availableSlots - 1 }
          : m,
      ),
    );
    setError(null);

    startTransition(() => {
      assignMentorToInstructor(menteeId, mentorId).catch((err) => {
        setError(String(err));
        setUnmatched((prev) => [mentee, ...prev]);
        setMentors((prev) =>
          prev.map((m) =>
            m.mentorId === mentorId
              ? { ...m, currentMenteeCount: m.currentMenteeCount - 1, availableSlots: m.availableSlots + 1 }
              : m,
          ),
        );
      });
    });
  }

  return (
    <div>
      {error && (
        <div
          style={{
            padding: "10px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            color: "#dc2626",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {error}
          <button onClick={() => setError(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}>×</button>
        </div>
      )}

      {isPending && (
        <div style={{ padding: "8px 16px", background: "#f5f3ff", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#7c3aed" }}>
          Saving assignment…
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left: unmatched instructors */}
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Unmatched ({filteredUnmatched.length})</span>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              Drag onto a mentor →
            </span>
          </div>
          <input
            placeholder="Search instructors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "70vh", overflowY: "auto" }}>
            {filteredUnmatched.length === 0 && (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 13,
                  border: "2px dashed #e5e7eb",
                  borderRadius: 8,
                }}
              >
                {unmatched.length === 0 ? "All instructors are matched!" : "No results."}
              </div>
            )}
            {filteredUnmatched.map((m) => (
              <MenteeCard
                key={m.userId}
                mentee={m}
                dragging={draggingId === m.userId}
                onDragStart={() => handleDragStart(m.userId)}
              />
            ))}
          </div>
        </div>

        {/* Right: mentor cards */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            Mentors ({filteredMentors.length})
          </div>
          <input
            placeholder="Search mentors…"
            value={searchMentor}
            onChange={(e) => setSearchMentor(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {filteredMentors.map((mentor) => {
              const full = mentor.availableSlots <= 0;
              const isOver = draggingOver === mentor.mentorId;
              return (
                <div
                  key={mentor.mentorId}
                  onDragOver={(e) => !full && handleDragOver(e, mentor.mentorId)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => !full && handleDrop(e, mentor.mentorId)}
                  className="card"
                  style={{
                    padding: 16,
                    border: isOver
                      ? "2px solid #7c3aed"
                      : full
                        ? "2px solid #fecaca"
                        : "2px solid transparent",
                    background: isOver ? "#f5f3ff" : full ? "#fef2f2" : undefined,
                    transition: "border-color .15s, background .15s",
                    opacity: full ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{mentor.mentorName}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {mentor.chapterName ?? "No chapter"} · {mentor.mentorEmail}
                      </div>
                    </div>
                    {full && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 8,
                          background: "#fecaca",
                          color: "#dc2626",
                          fontWeight: 700,
                        }}
                      >
                        FULL
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <CapacityBar filled={mentor.currentMenteeCount} max={mentor.maxMentees} />
                  </div>

                  {/* Quick assign dropdown */}
                  {!full && filteredUnmatched.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleManualAssign(e.target.value, mentor.mentorId);
                          e.target.value = "";
                        }}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          fontSize: 12,
                          background: "#fff",
                        }}
                      >
                        <option value="">Assign instructor…</option>
                        {filteredUnmatched.map((u) => (
                          <option key={u.userId} value={u.userId}>
                            {u.name} ({u.daysSinceStage}d)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={`/admin/instructors/${mentor.mentorId}`}
                      style={{ fontSize: 11, color: "#7c3aed" }}
                    >
                      View profile →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
