"use client";

import { useState } from "react";
import { createChannel } from "@/lib/chapter-channel-actions";

export function CreateChannelForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createChannel(new FormData(e.currentTarget));
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create the channel. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="button small" onClick={() => setOpen(true)}>
          + New Channel
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <h3 style={{ margin: 0 }}>Create Channel</h3>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </p>
      )}
      <input
        name="name"
        placeholder="channel-name (lowercase, hyphens)"
        className="input"
        required
        pattern="[a-z0-9-]+"
        maxLength={30}
      />
      <input
        name="description"
        placeholder="What is this channel for? (optional)"
        className="input"
      />
      <label style={{ fontSize: 13 }}>
        <input type="checkbox" name="isDefault" value="true" style={{ marginRight: 6 }} />
        Auto-join for new members
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button small" disabled={saving}>
          {saving ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          className="button small secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
