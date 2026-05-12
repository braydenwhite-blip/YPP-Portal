"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { MEETING_KIND_LABELS, MEETING_KIND_VALUES } from "@/lib/leadership-action-center/constants";
import {
  archiveMeeting,
  createMeeting,
  updateMeeting,
} from "@/lib/leadership-action-center/actions";

interface MeetingInitial {
  id?: string;
  title?: string;
  kind?: string;
  scheduledAt?: Date | string | null;
  notes?: string | null;
  ownerId?: string | null;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

function toLocalInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

const FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 12,
};
const LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const INPUT: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "#fff",
};

export default function MeetingForm({
  initial,
  users,
  onSaved,
  onCancel,
}: {
  initial?: MeetingInitial;
  users: UserOption[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<string>(initial?.kind ?? "OFFICERS");
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(initial?.scheduledAt));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ownerId, setOwnerId] = useState<string>(initial?.ownerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit && initial?.id) {
          await updateMeeting({
            id: initial.id,
            title: title.trim(),
            kind,
            scheduledAt: scheduledAt || undefined,
            notes: notes.trim(),
            ownerId: ownerId || undefined,
          });
        } else {
          await createMeeting({
            title: title.trim(),
            kind,
            scheduledAt: scheduledAt || undefined,
            notes: notes.trim(),
            ownerId: ownerId || undefined,
          });
        }
        router.refresh();
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function handleArchive() {
    if (!initial?.id) return;
    if (!confirm("Archive this meeting? Tasks linked to it stay in the tracker.")) return;
    startTransition(async () => {
      try {
        await archiveMeeting({ id: initial.id! });
        router.refresh();
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div
          role="alert"
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "8px 12px",
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      <div style={FIELD}>
        <label htmlFor="meeting-title" style={LABEL}>
          Title
        </label>
        <input
          id="meeting-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={INPUT}
          placeholder="e.g. Officers weekly sync"
        />
      </div>
      <div style={FIELD}>
        <label htmlFor="meeting-kind" style={LABEL}>
          Kind
        </label>
        <select
          id="meeting-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={INPUT}
        >
          {MEETING_KIND_VALUES.map((k) => (
            <option key={k} value={k}>
              {MEETING_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div style={FIELD}>
        <label htmlFor="meeting-when" style={LABEL}>
          Scheduled at
        </label>
        <input
          id="meeting-when"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          style={INPUT}
        />
      </div>
      <div style={FIELD}>
        <label htmlFor="meeting-owner" style={LABEL}>
          Owner
        </label>
        <select
          id="meeting-owner"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          style={INPUT}
        >
          <option value="">— Unassigned —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
      </div>
      <div style={FIELD}>
        <label htmlFor="meeting-notes" style={LABEL}>
          Standing notes
        </label>
        <textarea
          id="meeting-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ ...INPUT, fontFamily: "inherit", resize: "vertical" }}
          placeholder="Standing agenda items, links to docs, etc."
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={pending}
              className="button outline small"
              style={{ borderColor: "#dc2626", color: "#dc2626" }}
            >
              Archive
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="button outline small"
            >
              Cancel
            </button>
          )}
          <button type="submit" disabled={pending} className="button small">
            {pending ? "Saving…" : isEdit ? "Save" : "Create meeting"}
          </button>
        </div>
      </div>
    </form>
  );
}
