"use client";

import { useState, useTransition } from "react";
import { createActivity, deleteActivity, populateYppActivities } from "@/lib/college-activity-actions";
import type { CATEGORY_CONFIG } from "@/lib/college-activity-actions";

type CategoryConfigType = typeof CATEGORY_CONFIG;

interface Props {
  mode: "add-activity-form" | "delete-button" | "populate-ypp-button" | "export-button";
  activityId?: string;
  categoryConfig?: CategoryConfigType;
  exportData?: Array<{
    position: number;
    activityType: string;
    positionTitle: string;
    organizationName: string;
    description: string;
    isCurrentlyInvolved: boolean;
    participationGrades: string;
    hoursPerWeek: number;
    weeksPerYear: number;
  }>;
}

export default function ActivitiesClient({ mode, activityId, categoryConfig, exportData }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "populate-ypp-button") {
    return (
      <button
        className="button secondary small"
        onClick={() => {
          startTransition(async () => {
            try {
              const result = await populateYppActivities();
              if (result?.created === 0) {
                alert("YPP activities are already up to date!");
              } else {
                alert(`Added ${result?.created} YPP activity/activities!`);
              }
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to populate");
            }
          });
        }}
        disabled={isPending}
      >
        {isPending ? "Importing…" : "Import YPP Activities"}
      </button>
    );
  }

  if (mode === "delete-button" && activityId) {
    return (
      <button
        className="button secondary small"
        style={{ fontSize: "0.7rem", color: "#ef4444" }}
        onClick={() => {
          if (!confirm("Delete this activity?")) return;
          startTransition(async () => {
            try {
              await deleteActivity(activityId);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to delete");
            }
          });
        }}
        disabled={isPending}
      >
        Remove
      </button>
    );
  }

  if (mode === "export-button" && exportData) {
    function handleExport() {
      const lines = exportData!.map(
        (e) =>
          `${e.position}. ${e.activityType} | ${e.positionTitle} | ${e.organizationName}\n` +
          `   ${e.description}\n` +
          `   Hours/week: ${e.hoursPerWeek} | Weeks/year: ${e.weeksPerYear} | Grades: ${e.participationGrades} | Currently involved: ${e.isCurrentlyInvolved ? "Yes" : "No"}`
      );
      const text = lines.join("\n\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Common-App-Activities.txt";
      a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <button className="button primary small" onClick={handleExport} style={{ width: "100%" }}>
        Download Common App Format
      </button>
    );
  }

  if (mode === "add-activity-form" && categoryConfig) {
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        try {
          await createActivity(fd);
          (e.target as HTMLFormElement).reset();
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to add");
        }
      });
    }

    return (
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            name="name"
            required
            placeholder="Activity name *"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <select name="category" required className="input" style={{ width: "100%", fontSize: "0.82rem" }}>
            <option value="">Select category…</option>
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.emoji} {cfg.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            name="organization"
            placeholder="Organization"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            name="role"
            placeholder="Your role/position (max 50 chars)"
            maxLength={50}
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <textarea
            name="description"
            placeholder="Description (max 150 chars for Common App)"
            maxLength={150}
            rows={3}
            className="input"
            style={{ width: "100%", fontSize: "0.82rem", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.5rem" }}>
          <input
            name="hoursPerWeek"
            type="number"
            min={0}
            max={168}
            step={0.5}
            placeholder="Hrs/week"
            className="input"
            style={{ fontSize: "0.82rem" }}
          />
          <input
            name="weeksPerYear"
            type="number"
            min={0}
            max={52}
            placeholder="Weeks/year"
            className="input"
            style={{ fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            name="impactStatement"
            placeholder="Impact statement (optional)"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
            <input type="checkbox" name="isOngoing" value="true" defaultChecked />
            Currently involved
          </label>
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "0.4rem" }}>{error}</p>}
        <button type="submit" className="button primary small" style={{ width: "100%" }} disabled={isPending}>
          {saved ? "Added!" : isPending ? "Adding…" : "Add Activity"}
        </button>
      </form>
    );
  }

  return null;
}
