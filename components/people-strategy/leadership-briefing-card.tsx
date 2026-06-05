"use client";

import { useState } from "react";

/**
 * Leadership Briefing card (Phase 6) — shows the pre-composed weekly briefing
 * (built server-side by `buildLeadershipBriefing`) and lets a leader copy it in
 * one click to paste into Slack / email / Notion. Like the Follow-Up Generator,
 * it sends nothing; it only puts shareable text on the clipboard. Client-only
 * because it owns clipboard + reveal state.
 */
export function LeadershipBriefingCard({ briefing }: { briefing: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(briefing);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions / insecure context); revealing the
      // text lets the leader select it manually, so fail quietly.
      setOpen(true);
      setCopied(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
        A shareable, copy-pasteable summary of this week — pulse, what needs attention, who
        needs support, and wins. Nothing is sent.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={copy} className="button small">
          {copied ? "Copied ✓" : "Copy briefing"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="button outline small"
          aria-expanded={open}
        >
          {open ? "Hide preview" : "Preview"}
        </button>
      </div>
      {open ? (
        <textarea
          value={briefing}
          readOnly
          rows={14}
          className="input"
          style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5, fontFamily: "var(--font-mono, monospace)" }}
          aria-label="Weekly leadership briefing"
        />
      ) : null}
    </div>
  );
}
