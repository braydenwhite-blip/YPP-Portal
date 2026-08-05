"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateClassHomeSettings } from "@/lib/classes/class-home-settings-actions";
import {
  meetingTimeFromTwelveHourInput,
  meetingTimeToTwelveHourInput,
} from "@/lib/class-meeting-time";

export const CLASS_THEME_PRESETS = [
  { id: "red", label: "Red", color: "#dc2626" },
  { id: "orange", label: "Orange", color: "#ea580c" },
  { id: "amber", label: "Amber", color: "#d97706" },
  { id: "yellow", label: "Yellow", color: "#ca8a04" },
  { id: "lime", label: "Lime", color: "#65a30d" },
  { id: "green", label: "Green", color: "#16a34a" },
  { id: "teal", label: "Teal", color: "#0d9488" },
  { id: "cyan", label: "Cyan", color: "#0891b2" },
  { id: "blue", label: "Blue", color: "#2563eb" },
  { id: "indigo", label: "Indigo", color: "#4f46e5" },
  { id: "violet", label: "Violet", color: "#7c3aed" },
  { id: "purple", label: "YPP purple", color: "#6b21c8" },
  { id: "fuchsia", label: "Fuchsia", color: "#c026d3" },
  { id: "pink", label: "Pink", color: "#db2777" },
  { id: "rose", label: "Rose", color: "#e11d48" },
  { id: "black", label: "Black", color: "#111827" },
] as const;

const WEEKDAYS = [
  { value: "Sunday", short: "Sun" },
  { value: "Monday", short: "Mon" },
  { value: "Tuesday", short: "Tue" },
  { value: "Wednesday", short: "Wed" },
  { value: "Thursday", short: "Thu" },
  { value: "Friday", short: "Fri" },
  { value: "Saturday", short: "Sat" },
] as const;

export function ClassSettingsPanel({
  offeringId,
  title,
  themeColor,
  enrollmentOpen,
  semester,
  meetingDays,
  meetingTime,
}: {
  offeringId: string;
  title: string;
  themeColor: string | null | undefined;
  enrollmentOpen: boolean;
  semester: string | null | undefined;
  meetingDays: string[];
  meetingTime: string | null | undefined;
}) {
  const router = useRouter();
  const initial = (themeColor && /^#[0-9a-fA-F]{6}$/.test(themeColor)
    ? themeColor
    : "#6b21c8"
  ).toLowerCase();
  const [color, setColor] = useState(initial);
  const [days, setDays] = useState(
    () => new Set(meetingDays.filter((d) => WEEKDAYS.some((w) => w.value === d))),
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: (typeof WEEKDAYS)[number]["value"]) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    formData.set("offeringId", offeringId);
    formData.set("themeColor", color);
    formData.delete("meetingDays");
    for (const day of WEEKDAYS) {
      if (days.has(day.value)) formData.append("meetingDays", day.value);
    }
    const displayTime = String(formData.get("meetingTimeDisplay") ?? "");
    formData.set("meetingTime", meetingTimeFromTwelveHourInput(displayTime));
    formData.delete("meetingTimeDisplay");
    startTransition(async () => {
      try {
        await updateClassHomeSettings(formData);
        setMessage("Settings saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save settings.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="m-0 text-[18px] font-normal text-[#202124]">Settings</h2>
      <p className="m-0 mt-1 text-[13px] text-[#5f6368]">
        Color, name, and schedule for this class.
      </p>

      <form
        action={submit}
        className="mt-6 space-y-6 rounded-xl border border-[#dadce0] bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)]"
      >
        <div>
          <p className="m-0 text-[13px] font-medium text-[#202124]">Color</p>
          <p className="m-0 mt-0.5 text-[12px] text-[#5f6368]">
            Banner color for this class.
          </p>
          <div
            className="mt-3 h-16 rounded-xl border border-black/10"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {CLASS_THEME_PRESETS.map((preset) => {
              const active = color === preset.color;
              const isDark = preset.id === "black";
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={active}
                  onClick={() => setColor(preset.color)}
                  className={[
                    "h-9 w-9 rounded-full border-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] transition",
                    active
                      ? isDark
                        ? "border-[#6b21c8] scale-110"
                        : "border-[#202124] scale-110"
                      : "border-white hover:scale-105",
                  ].join(" ")}
                  style={{ backgroundColor: preset.color }}
                />
              );
            })}
          </div>
          <label className="mt-3 block text-[12px] font-medium text-[#5f6368]" htmlFor="theme-custom">
            Custom color
          </label>
          <input
            id="theme-custom"
            type="text"
            value={color}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v.toLowerCase());
            }}
            className="mt-1 w-40 rounded-lg border border-[#dadce0] px-3 py-2 font-mono text-[13px]"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#202124]" htmlFor="class-title">
            Class name
          </label>
          <input
            id="class-title"
            name="title"
            required
            defaultValue={title}
            className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#202124]" htmlFor="class-semester">
            Term
          </label>
          <input
            id="class-semester"
            name="semester"
            defaultValue={semester ?? ""}
            placeholder="Spring 2026"
            className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />
        </div>

        <div>
          <p className="m-0 text-[13px] font-medium text-[#202124]">Class days</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Class days">
            {WEEKDAYS.map((day) => {
              const active = days.has(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleDay(day.value)}
                  className={[
                    "min-h-9 min-w-11 rounded-full border px-3 text-[13px] font-medium transition",
                    active
                      ? "border-[#1967d2] bg-[#e8f0fe] text-[#1967d2]"
                      : "border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa]",
                  ].join(" ")}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#202124]" htmlFor="class-time">
            Time
          </label>
          <input
            id="class-time"
            name="meetingTimeDisplay"
            defaultValue={meetingTimeToTwelveHourInput(meetingTime)}
            placeholder="4:00 pm – 5:00 pm"
            className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#202124]">
          <input
            type="checkbox"
            name="enrollmentOpen"
            defaultChecked={enrollmentOpen}
            className="h-4 w-4 rounded border-[#dadce0]"
          />
          New students can still join
        </label>

        {message ? (
          <p className="m-0 text-[13px] font-medium text-[#137333]" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 text-[13px] text-[#c5221f]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          disabled={pending || !/^#[0-9a-fA-F]{6}$/.test(color)}
          className="min-h-10 rounded-full bg-[#1967d2] px-4 text-[13px] font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
          style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
