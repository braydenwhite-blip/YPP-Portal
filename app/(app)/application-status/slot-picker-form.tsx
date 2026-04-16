"use client";

import { useState, useTransition } from "react";
import { selectInterviewSlot } from "@/lib/instructor-application-actions";

type OfferedSlot = {
  id: string;
  scheduledAt: Date | string;
  durationMinutes: number;
};

export default function SlotPickerForm({ slots }: { slots: OfferedSlot[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(slotId: string) {
    setActiveId(slotId);
    setError(null);
    startTransition(async () => {
      const result = await selectInterviewSlot(slotId);
      if (!result.success) {
        setError(result.error || "Failed to confirm this time. Please try again.");
        setActiveId(null);
      }
      // On success the page will revalidate via revalidatePath in the action
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {slots.map((slot) => {
        const date = new Date(slot.scheduledAt);
        const isSelecting = isPending && activeId === slot.id;
        return (
          <div
            key={slot.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              gap: 12,
            }}
          >
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>
                {date.toLocaleString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
                {slot.durationMinutes} minutes
              </p>
            </div>
            <button
              className="button"
              onClick={() => handleSelect(slot.id)}
              disabled={isPending}
              style={{ fontSize: 13, minWidth: 130, flexShrink: 0 }}
            >
              {isSelecting ? "Confirming..." : "Select This Time"}
            </button>
          </div>
        );
      })}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
