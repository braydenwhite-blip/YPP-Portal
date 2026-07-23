"use client";

import { useTransition } from "react";

import { updateStaffApplicantLocation } from "@/lib/application-actions";
import {
  updateChapterPresidentApplicantChapter,
  updateInstructorApplicantChapter,
} from "@/lib/applicant-chapter-location-actions";

type Mode = "instructor" | "cp" | "staff";

const CHAPTER_LABELS = {
  instructor: {
    field: "Chapter",
    empty: "No chapter yet",
    save: "Save chapter",
  },
  cp: {
    field: "Chapter",
    empty: "No chapter yet / new chapter",
    save: "Save chapter",
  },
} as const;

export function ApplicantChapterLocationEditor({
  mode,
  applicationId,
  currentChapterId,
  currentLocation,
  options = [],
  locationSuggestions = ["The Bronx", "Scarsdale"],
}: {
  mode: Mode;
  applicationId: string;
  currentChapterId?: string | null;
  /** Free-text staff location. */
  currentLocation?: string | null;
  options?: Array<{ id: string; name: string }>;
  locationSuggestions?: string[];
}) {
  const [pending, startTransition] = useTransition();

  if (mode === "staff") {
    const listId = `staff-location-${applicationId}`;
    return (
      <form
        className="flex flex-wrap items-end gap-2"
        action={(formData) => {
          startTransition(async () => {
            await updateStaffApplicantLocation(formData);
          });
        }}
      >
        <input type="hidden" name="applicationId" value={applicationId} />
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
          Location
          <input
            name="location"
            type="text"
            list={listId}
            defaultValue={currentLocation ?? ""}
            disabled={pending}
            placeholder="Type a city, neighborhood, or chapter…"
            autoComplete="off"
            className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold normal-case tracking-normal text-ink"
          />
          <datalist id={listId}>
            {locationSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save location"}
        </button>
      </form>
    );
  }

  const labels = CHAPTER_LABELS[mode];
  const action =
    mode === "cp"
      ? updateChapterPresidentApplicantChapter
      : updateInstructorApplicantChapter;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
        });
      }}
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {labels.field}
        <select
          name="chapterId"
          defaultValue={currentChapterId ?? ""}
          disabled={pending}
          className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold normal-case tracking-normal text-ink"
        >
          <option value="">{labels.empty}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : labels.save}
      </button>
    </form>
  );
}

/** @deprecated Prefer ApplicantChapterLocationEditor with mode="staff" */
export function StaffLocationEditor(props: {
  applicationId: string;
  currentLocation?: string | null;
  /** @deprecated ignored — location is free text now */
  currentChapterId?: string | null;
  locations?: Array<{ id: string; name: string }>;
}) {
  return (
    <ApplicantChapterLocationEditor
      mode="staff"
      applicationId={props.applicationId}
      currentLocation={
        props.currentLocation ??
        props.locations?.find((l) => l.id === props.currentChapterId)?.name ??
        null
      }
      locationSuggestions={
        props.locations?.map((l) => l.name) ?? ["The Bronx", "Scarsdale"]
      }
    />
  );
}
