"use client";

import { useState } from "react";
import { createChannel } from "@/lib/chapter-channel-actions";

export function CreateChannelForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await createChannel(new FormData(e.currentTarget));
      setOpen(false);
    } catch {
      // handled by server
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
