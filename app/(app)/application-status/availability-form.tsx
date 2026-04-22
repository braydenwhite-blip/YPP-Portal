"use client";

import { useState, useTransition } from "react";
import { submitCPAvailability, submitInstructorAvailability, type AvailabilityWindow } from "@/lib/availability-actions";

// ---- Constants ----

const DAYS = [
  { label: "Sunday",    value: 0 },
  { label: "Monday",    value: 1 },
  { label: "Tuesday",   value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday",  value: 4 },
  { label: "Friday",    value: 5 },
  { label: "Saturday",  value: 6 },
];

// 30-min increments from 6:00 to 22:00 (6 AM – 10 PM)
function buildTimeOptions() {
  const opts: { label: string; value: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const hStr = String(h).padStart(2, "0");
      const mStr = String(m).padStart(2, "0");
      const value = `${hStr}:${mStr}`;
      const period = h < 12 ? "AM" : "PM";
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mStr} ${period}`;
      opts.push({ label, value });
    }
  }
  return opts;
}
const TIME_OPTIONS = buildTimeOptions();

const TIMEZONES = [
  { label: "Eastern Time (ET)",          value: "America/New_York" },
  { label: "Central Time (CT)",          value: "America/Chicago" },
  { label: "Mountain Time (MT)",         value: "America/Denver" },
  { label: "Mountain Time – AZ (no DST)", value: "America/Phoenix" },
  { label: "Pacific Time (PT)",          value: "America/Los_Angeles" },
  { label: "Alaska Time (AKT)",          value: "America/Anchorage" },
  { label: "Hawaii Time (HST)",          value: "Pacific/Honolulu" },
  { label: "Toronto / Eastern (CA)",     value: "America/Toronto" },
  { label: "Vancouver / Pacific (CA)",   value: "America/Vancouver" },
  { label: "London (GMT/BST)",           value: "Europe/London" },
  { label: "Paris / Berlin (CET)",       value: "Europe/Paris" },
  { label: "India Standard Time (IST)",  value: "Asia/Kolkata" },
  { label: "Philippines (PHT)",          value: "Asia/Manila" },
  { label: "New Zealand (NZST)",         value: "Pacific/Auckland" },
];

const DEFAULT_WINDOW: AvailabilityWindow = {
  dayOfWeek: 1,
  startTime: "14:00",
  endTime: "16:00",
  timezone: "America/New_York",
};

// ---- Component ----

export default function AvailabilityForm({
  applicationId,
  variant,
  existingWindows,
  hadNoMatch,
}: {
  applicationId: string;
  variant: "cp" | "instructor";
  existingWindows: AvailabilityWindow[];
  hadNoMatch: boolean;
}) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>(
    existingWindows.length > 0 ? existingWindows : [{ ...DEFAULT_WINDOW }]
  );
  const [submitState, setSubmitState] = useState<"idle" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCp = variant === "cp";
  const sessionLabel = isCp ? "interview" : "curriculum review session";
  const heading = isCp
    ? "Tell us when you're free for your interview"
    : "Interview times are coming from your lead interviewer";
  const subheading = isCp
    ? "Add up to 5 recurring weekly windows and we'll find the first slot that works for both you and your interviewer."
    : "You do not need to submit availability windows. Your lead interviewer will send a few proposed times here for you to choose from.";
  const submitLabel = isCp ? "Find My Interview Time" : "Find My Session Time";

  if (!isCp) {
    return (
      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 6px", color: "#1c1917", fontSize: 16, fontWeight: 700 }}>
          {heading}
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
          {subheading}
        </p>
      </div>
    );
  }

  function updateWindow(index: number, patch: Partial<AvailabilityWindow>) {
    setWindows((prev) =>
      prev.map((w, i) => (i === index ? { ...w, ...patch } : w))
    );
  }

  function addWindow() {
    if (windows.length >= 5) return;
    const last = windows[windows.length - 1];
    setWindows((prev) => [...prev, { ...last }]);
  }

  function removeWindow(index: number) {
    if (windows.length <= 1) return;
    setWindows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    setErrorMsg(null);

    // Validate: each window must have endTime > startTime
    for (const w of windows) {
      if (w.startTime >= w.endTime) {
        setErrorMsg("Each window's end time must be after its start time.");
        return;
      }
    }

    startTransition(async () => {
      const fn = isCp ? submitCPAvailability : submitInstructorAvailability;
      const result = await fn(applicationId, windows);
      if (!result.success) {
        setErrorMsg(result.error ?? "Something went wrong.");
        return;
      }
      setSubmitState("done");
    });
  }

  if (submitState === "done") {
    return (
      <div style={{
        background: "#f5f3ff",
        border: "1px solid #ede9fe",
        borderRadius: 12,
        padding: "24px 20px",
        textAlign: "center",
        marginTop: 16,
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
        <h3 style={{ margin: "0 0 8px", color: "#4c1d95", fontSize: 16, fontWeight: 700 }}>
          We&apos;re finding your match!
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: "#5b21b6" }}>
          We&apos;re checking your windows against the reviewer&apos;s schedule. You&apos;ll receive a confirmation email as soon as a time is locked in. You can also refresh this page to check.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Heading */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 6px", color: "#1c1917", fontSize: 16, fontWeight: 700 }}>
          {heading}
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
          {subheading}
        </p>
      </div>

      {/* No-match retry banner */}
      {hadNoMatch && (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderLeft: "4px solid #f59e0b",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 20,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: "#92400e", fontWeight: 600 }}>
            No match found with your previous windows
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
            Try adding more days or expanding your time ranges, and we&apos;ll try again automatically.
          </p>
        </div>
      )}

      {/* Window rows */}
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        {windows.map((win, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(110px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(160px, 1.5fr) auto",
              gap: 8,
              alignItems: "center",
              background: "var(--surface-alt, #f9fafb)",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            {/* Day */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Day
              </label>
              <select
                value={win.dayOfWeek}
                onChange={(e) => updateWindow(i, { dayOfWeek: Number(e.target.value) })}
                style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "white" }}
              >
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* From */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                From
              </label>
              <select
                value={win.startTime}
                onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "white" }}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* To */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                To
              </label>
              <select
                value={win.endTime}
                onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "white" }}
              >
                {TIME_OPTIONS.filter((t) => t.value > win.startTime).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Timezone
              </label>
              <select
                value={win.timezone}
                onChange={(e) => updateWindow(i, { timezone: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "white" }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeWindow(i)}
              disabled={windows.length <= 1}
              aria-label="Remove window"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid var(--border, #e5e7eb)",
                background: windows.length <= 1 ? "transparent" : "white",
                cursor: windows.length <= 1 ? "default" : "pointer",
                color: windows.length <= 1 ? "var(--muted)" : "#dc2626",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 20,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add window */}
      <button
        type="button"
        onClick={addWindow}
        disabled={windows.length >= 5}
        style={{
          fontSize: 13,
          color: windows.length >= 5 ? "var(--muted)" : "#7c3aed",
          background: "transparent",
          border: "none",
          cursor: windows.length >= 5 ? "default" : "pointer",
          padding: "4px 0",
          marginBottom: 20,
          fontWeight: 600,
        }}
      >
        + Add another window {windows.length >= 5 ? "(max 5)" : ""}
      </button>

      {/* Error */}
      {errorMsg && (
        <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 12px" }}>{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        style={{
          background: isPending ? "#a78bfa" : "#6b21c8",
          color: "white",
          border: "none",
          borderRadius: 9999,
          padding: "12px 28px",
          fontWeight: 700,
          fontSize: 14,
          cursor: isPending ? "default" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {isPending && (
          <span style={{
            width: 14,
            height: 14,
            border: "2px solid rgba(255,255,255,0.4)",
            borderTopColor: "white",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }} />
        )}
        {isPending ? `Finding your ${sessionLabel} time…` : submitLabel}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
