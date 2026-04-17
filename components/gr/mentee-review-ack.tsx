"use client";

import { useState, useTransition } from "react";
import { submitReviewAck } from "@/lib/gr-actions";

const REACTIONS = [
  { value: "GRATEFUL", label: "🙏", text: "Grateful" },
  { value: "MOTIVATED", label: "💪", text: "Motivated" },
  { value: "UNCLEAR", label: "😕", text: "Unclear" },
  { value: "UNSURE", label: "❓", text: "Need to talk" },
] as const;

interface MenteeReviewAckProps {
  reviewId: string;
  existingAck?: { reaction: string; note: string | null } | null;
}

export function MenteeReviewAck({ reviewId, existingAck }: MenteeReviewAckProps) {
  const [selected, setSelected] = useState(existingAck?.reaction ?? "");
  const [note, setNote] = useState(existingAck?.note ?? "");
  const [saved, setSaved] = useState(!!existingAck);
  const [isPending, startTransition] = useTransition();

  function save(reaction: string) {
    setSelected(reaction);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reviewId", reviewId);
      fd.set("reaction", reaction);
      if (note.trim()) fd.set("note", note.trim());
      await submitReviewAck(fd);
      setSaved(true);
    });
  }

  return (
    <div
      style={{
        background: "var(--surface-alt)",
        borderRadius: 8,
        padding: "1rem",
        marginTop: "0.75rem",
      }}
    >
      <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
        How does this feedback land?
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {REACTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => save(r.value)}
            disabled={isPending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.3rem 0.65rem",
              borderRadius: 20,
              border: `1.5px solid ${selected === r.value ? "var(--ypp-purple-500)" : "var(--border)"}`,
              background: selected === r.value ? "var(--ypp-purple-50, #f5f3ff)" : "var(--surface)",
              color: selected === r.value ? "var(--ypp-purple-700, #6d28d9)" : "var(--text)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: selected === r.value ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            <span>{r.label}</span>
            <span>{r.text}</span>
          </button>
        ))}
      </div>

      {selected && !saved && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          style={{
            marginTop: "0.5rem",
            width: "100%",
            resize: "vertical",
            padding: "0.4rem 0.6rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: "0.82rem",
            background: "var(--surface)",
            color: "var(--text)",
            boxSizing: "border-box",
          }}
        />
      )}

      {saved && (
        <p style={{ fontSize: "0.78rem", color: "var(--success, #22c55e)", marginTop: "0.4rem" }}>
          ✓ Reaction saved
        </p>
      )}
    </div>
  );
}
