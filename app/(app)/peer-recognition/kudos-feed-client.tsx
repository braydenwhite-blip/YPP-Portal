"use client";

import { useState, useTransition } from "react";
import { sendKudos, deleteKudos } from "@/lib/peer-recognition-actions";

type Recipient = { id: string; name: string; role: string | null };
type CategoryConfig = Record<string, { label: string; emoji: string; color: string }>;

interface Props {
  mode: "send-form" | "delete-button";
  recipients?: Recipient[];
  categoryConfig?: CategoryConfig;
  kudosId?: string;
}

export default function KudosFeedClient({ mode, recipients = [], categoryConfig = {}, kudosId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "delete-button" && kudosId) {
    return (
      <button
        className="button secondary small"
        style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
        onClick={() => {
          if (!confirm("Delete this kudos?")) return;
          startTransition(async () => {
            try {
              await deleteKudos(kudosId);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to delete");
            }
          });
        }}
        disabled={isPending}
      >
        Delete
      </button>
    );
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
        <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</p>
        <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Kudos sent!</p>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Your shout-out is now visible in the feed.
        </p>
        <button className="button secondary small" onClick={() => setSent(false)}>
          Send Another
        </button>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await sendKudos(formData);
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
          Recognize
        </label>
        <select name="receiverId" required className="input" style={{ width: "100%" }}>
          <option value="">Select a teammate…</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
          Category
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.8rem",
                cursor: "pointer",
                padding: "0.3rem 0.5rem",
                borderRadius: "6px",
                border: "1px solid var(--border)",
              }}
            >
              <input type="radio" name="category" value={key} required style={{ accentColor: cfg.color }} />
              {cfg.emoji} {cfg.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
          Message
        </label>
        <textarea
          name="message"
          required
          maxLength={500}
          rows={4}
          placeholder="Describe what they did and why it matters…"
          className="input"
          style={{ width: "100%", resize: "vertical" }}
        />
        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.2rem" }}>Max 500 characters</p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", cursor: "pointer" }}>
          <input type="checkbox" name="isPublic" value="true" defaultChecked />
          Visible in public feed
        </label>
      </div>

      {error && (
        <p style={{ color: "#ef4444", fontSize: "0.82rem", marginBottom: "0.75rem" }}>{error}</p>
      )}

      <button type="submit" className="button primary" style={{ width: "100%" }} disabled={isPending}>
        {isPending ? "Sending…" : "Send Kudos 🎉"}
      </button>
    </form>
  );
}
