"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  requestNewInterviewTimes,
  selectInterviewSlot,
} from "@/lib/instructor-application-actions";

type OfferedSlot = {
  id: string;
  scheduledAt: Date | string;
  durationMinutes: number;
};

export default function SlotPickerForm({
  applicationId,
  slots,
}: {
  applicationId: string;
  slots: OfferedSlot[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSelect(slotId: string) {
    setActiveId(slotId);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await selectInterviewSlot(slotId);
      if (!result.success) {
        setError(result.error || "Failed to confirm this time. Please try again.");
        setActiveId(null);
      } else {
        // Soft-refresh the server component so the confirmed time renders
        // without a full page navigation. revalidatePath in the action invalidates
        // the cache; router.refresh() causes the browser to pick up the new data.
        router.refresh();
      }
    });
  }

  function handleRequestNewTimes() {
    setActiveId("none");
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await requestNewInterviewTimes(applicationId);
      if (!result.success) {
        setError(result.error || "Failed to request new times. Please try again.");
        setActiveId(null);
      } else {
        setNotice("Thanks. We let your lead interviewer know to send a new set of times.");
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {slots.map((slot) => {
        const date = new Date(slot.scheduledAt);
        const isPast = date <= new Date();
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
              background: isPast ? "var(--surface-2)" : "var(--surface-2)",
              border: `1px solid ${isPast ? "var(--border)" : "var(--border)"}`,
              opacity: isPast ? 0.6 : 1,
              gap: 12,
            }}
          >
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: isPast ? "var(--muted)" : undefined }}>
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
                {isPast && (
                  <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 500 }}>
                    · This time has passed — contact your reviewer to get new times
                  </span>
                )}
              </p>
            </div>
            <button
              className="button"
              onClick={() => !isPast && handleSelect(slot.id)}
              disabled={isPending || isPast}
              style={{
                fontSize: 13,
                minWidth: 130,
                flexShrink: 0,
                opacity: isPast ? 0.4 : 1,
                cursor: isPast ? "not-allowed" : undefined,
              }}
              title={isPast ? "This time has already passed" : undefined}
            >
              {isSelecting ? "Confirming..." : isPast ? "Time Passed" : "Select This Time"}
            </button>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          type="button"
          className="button outline"
          onClick={handleRequestNewTimes}
          disabled={isPending}
          style={{ fontSize: 13 }}
        >
          {isPending && activeId === "none" ? "Sending..." : "None of These Work"}
        </button>
      </div>
      {notice && (
        <p style={{ color: "#15803d", fontSize: 13, margin: "4px 0 0", fontWeight: 600 }}>{notice}</p>
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
