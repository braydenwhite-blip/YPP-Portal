"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addOnboardingStep,
  removeOnboardingStep,
  toggleStepRequired,
} from "@/lib/chapter-onboarding-actions";

type Step = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  sortOrder: number;
  isRequired: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  COMPLETE_PROFILE: "Complete Profile",
  MEET_THE_TEAM: "Meet the Team",
  JOIN_CHANNELS: "Join Channels",
  INTRODUCE_SELF: "Introduce Self",
  FIRST_PATHWAY: "Explore Pathway",
  INTRO_VIDEO: "Intro Video",
  SET_INTERESTS: "Set Interests",
  CUSTOM: "Custom",
};

export function OnboardingConfigPanel({ steps }: { steps: Step[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function handleToggleRequired(stepId: string) {
    setActionId(stepId);
    try {
      await toggleStepRequired(stepId);
      startTransition(() => router.refresh());
    } catch {
      // ignore
    } finally {
      setActionId(null);
    }
  }

  async function handleRemove(stepId: string) {
    if (!confirm("Remove this onboarding step? Member progress for this step will also be deleted.")) {
      return;
    }
    setActionId(stepId);
    try {
      await removeOnboardingStep(stepId);
      startTransition(() => router.refresh());
    } catch {
      // ignore
    } finally {
      setActionId(null);
    }
  }

  async function handleAdd(formData: FormData) {
    try {
      await addOnboardingStep(formData);
      setShowAddForm(false);
      startTransition(() => router.refresh());
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Current Steps</h3>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{steps.length} steps</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{step.title}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "var(--bg)",
                      color: "var(--muted)",
                    }}
                  >
                    {TYPE_LABELS[step.type] ?? step.type}
                  </span>
                </div>
                {step.description && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {step.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => handleToggleRequired(step.id)}
                disabled={isPending || actionId === step.id}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: step.isRequired ? "#ede9fe" : "var(--bg)",
                  color: step.isRequired ? "#6d28d9" : "var(--muted)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {step.isRequired ? "Required" : "Optional"}
              </button>

              <button
                onClick={() => handleRemove(step.id)}
                disabled={isPending || actionId === step.id}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#dc2626",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Custom Step */}
      {showAddForm ? (
        <div className="card">
          <h3 style={{ margin: "0 0 12px" }}>Add Custom Step</h3>
          <form action={handleAdd}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Title</label>
                <input
                  name="title"
                  className="input"
                  required
                  placeholder="e.g., Read the Code of Conduct"
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Description</label>
                <textarea
                  name="description"
                  className="input"
                  rows={2}
                  placeholder="Brief instructions for new members"
                  style={{ marginTop: 4 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="isRequired" value="true" id="isRequired" />
                <label htmlFor="isRequired" style={{ fontSize: 13 }}>Required step</label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="button" style={{ fontSize: 13 }}>
                  Add Step
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{
                    fontSize: 13,
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <button
          className="button"
          onClick={() => setShowAddForm(true)}
          style={{ fontSize: 13 }}
        >
          + Add Custom Step
        </button>
      )}
    </div>
  );
}
