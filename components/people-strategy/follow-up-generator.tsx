"use client";

import { useMemo, useState } from "react";

import {
  FOLLOW_UP_TONES,
  generateFollowUp,
  type FollowUpContext,
  type FollowUpTone,
} from "@/lib/people-strategy/momentum";

/**
 * Follow-Up Generator — drafts a copyable nudge for a slipping action item.
 *
 * Intentionally does NOT send anything: it produces plain text the leader copies
 * into email / Slack. The generated text is editable before copying, so the
 * draft is a starting point, never the final word. Client-only because it owns
 * selection + clipboard state.
 */

export interface FollowUpCandidate {
  id: string;
  title: string;
  ownerName: string;
  dueLabel: string;
  daysOverdue: number;
  meetingLabel?: string | null;
}

export function FollowUpGenerator({ candidates }: { candidates: FollowUpCandidate[] }) {
  const [selectedId, setSelectedId] = useState<string>(candidates[0]?.id ?? "");
  const [tone, setTone] = useState<FollowUpTone>("reminder");
  const [draft, setDraft] = useState<string>("");
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) ?? candidates[0],
    [candidates, selectedId]
  );

  const computedDraft = useMemo(() => {
    if (!selected) return "";
    const ctx: FollowUpContext = {
      itemTitle: selected.title,
      ownerName: selected.ownerName,
      dueLabel: selected.dueLabel,
      daysOverdue: selected.daysOverdue,
      meetingLabel: selected.meetingLabel ?? null,
    };
    return generateFollowUp(tone, ctx);
  }, [selected, tone]);

  // The textarea shows the user's edits if they've touched it, else the live draft.
  const value = edited ? draft : computedDraft;

  function reset(next: Partial<{ id: string; tone: FollowUpTone }>) {
    if (next.id !== undefined) setSelectedId(next.id);
    if (next.tone !== undefined) setTone(next.tone);
    setEdited(false);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions / insecure context); selecting the
      // text manually still works, so fail quietly rather than throwing.
      setCopied(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
        Nothing needs a follow-up right now — every owner is on track. 🎉
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="followup-item" style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
          Item to follow up on
        </label>
        <select
          id="followup-item"
          value={selectedId}
          onChange={(e) => reset({ id: e.target.value })}
          className="input"
          style={{ maxWidth: "100%" }}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {c.ownerName}
              {c.daysOverdue > 0 ? ` (${c.daysOverdue}d overdue)` : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FOLLOW_UP_TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => reset({ tone: t.key })}
            className={tone === t.key ? "button small" : "button outline small"}
            title={t.description}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(e) => {
          setDraft(e.target.value);
          setEdited(true);
        }}
        rows={5}
        className="input"
        style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
        aria-label="Follow-up message draft"
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={copy} className="button small">
          {copied ? "Copied ✓" : "Copy message"}
        </button>
        {edited ? (
          <button type="button" onClick={() => setEdited(false)} className="button outline small">
            Reset to draft
          </button>
        ) : null}
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Draft only — nothing is sent. Copy it wherever you reach out.
        </span>
      </div>
    </div>
  );
}
