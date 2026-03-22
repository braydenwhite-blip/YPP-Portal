"use client";

import { useState, useTransition } from "react";
import { sendIntroRequest, respondToIntroRequest } from "@/lib/alumni-network-actions";

interface Props {
  alumniId?: string;
  alumniName?: string;
  requestId?: string;
  mode?: "send" | "respond";
}

export default function IntroRequestClient({ alumniId, alumniName, requestId, mode = "send" }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "respond" && requestId) {
    return (
      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
        <button
          className="button primary small"
          onClick={() => {
            const fd = new FormData();
            fd.set("requestId", requestId);
            fd.set("status", "ACCEPTED");
            startTransition(async () => {
              try { await respondToIntroRequest(fd); }
              catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
            });
          }}
          disabled={isPending}
          style={{ fontSize: "0.72rem" }}
        >
          Accept
        </button>
        <button
          className="button secondary small"
          onClick={() => {
            const fd = new FormData();
            fd.set("requestId", requestId);
            fd.set("status", "DECLINED");
            startTransition(async () => {
              try { await respondToIntroRequest(fd); }
              catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
            });
          }}
          disabled={isPending}
          style={{ fontSize: "0.72rem" }}
        >
          Decline
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <span className="pill" style={{ fontSize: "0.65rem", background: "#dcfce7", color: "#166534" }}>
        Request Sent!
      </span>
    );
  }

  if (!showForm) {
    return (
      <button
        className="button secondary small"
        onClick={() => setShowForm(true)}
        style={{ fontSize: "0.75rem" }}
      >
        Connect →
      </button>
    );
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Introduce yourself to ${alumniName ?? "this alumni"}…`}
        rows={3}
        maxLength={500}
        className="input"
        style={{ width: "100%", fontSize: "0.78rem", resize: "vertical", marginBottom: "0.4rem" }}
      />
      {error && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginBottom: "0.3rem" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button
          className="button primary small"
          onClick={() => {
            if (!message.trim()) { setError("Please write a message"); return; }
            const fd = new FormData();
            fd.set("alumniId", alumniId!);
            fd.set("message", message);
            setError(null);
            startTransition(async () => {
              try {
                await sendIntroRequest(fd);
                setSent(true);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to send");
              }
            });
          }}
          disabled={isPending}
          style={{ fontSize: "0.72rem" }}
        >
          {isPending ? "Sending…" : "Send Request"}
        </button>
        <button
          className="button secondary small"
          onClick={() => { setShowForm(false); setMessage(""); setError(null); }}
          style={{ fontSize: "0.72rem" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
