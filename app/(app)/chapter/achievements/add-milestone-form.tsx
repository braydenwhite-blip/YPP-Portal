"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomMilestone } from "@/lib/chapter-gamification-actions";

export function AddMilestoneForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(formData: FormData) {
    try {
      await createCustomMilestone(formData);
      setShowForm(false);
      startTransition(() => router.refresh());
    } catch {
      // ignore
    }
  }

  if (!showForm) {
    return (
      <button className="button" onClick={() => setShowForm(true)} style={{ fontSize: 13 }}>
        + Add Custom Milestone
      </button>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 12px" }}>Add Custom Milestone</h3>
      <form action={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="grid two">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Title</label>
              <input
                name="title"
                className="input"
                required
                placeholder="e.g., Community Champion"
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Icon (emoji)</label>
              <input
                name="icon"
                className="input"
                placeholder="🏆"
                defaultValue="⭐"
                maxLength={4}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Description</label>
            <input
              name="description"
              className="input"
              placeholder="What does this milestone celebrate?"
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Target Value</label>
            <input
              name="threshold"
              className="input"
              type="number"
              min="1"
              required
              placeholder="e.g., 25"
              style={{ marginTop: 4 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="submit" className="button" disabled={isPending} style={{ fontSize: 13 }}>
              {isPending ? "..." : "Create Milestone"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                fontSize: 13, padding: "6px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
