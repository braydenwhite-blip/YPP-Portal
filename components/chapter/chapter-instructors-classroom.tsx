"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

import {
  Button,
  EmptyStateV2,
  ModalFooterV2,
  ModalV2,
  StatusBadge,
} from "@/components/ui-v2";
import { createClassOffering } from "@/lib/class-management-actions";

const COVER_PALETTE = [
  { from: "#1a73e8", to: "#174ea6" },
  { from: "#0d904f", to: "#0b8043" },
  { from: "#d93025", to: "#a50e0e" },
  { from: "#e37400", to: "#b06000" },
  { from: "#9334e6", to: "#681da8" },
  { from: "#00786a", to: "#005f56" },
  { from: "#e52592", to: "#c2185b" },
  { from: "#5f6368", to: "#3c4043" },
] as const;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type ChapterInstructorOffering = {
  id: string;
  title: string;
  status: string;
  themeColor: string | null;
  deliveryMode: string | null;
  meetingDays: string[];
  meetingTime: string | null;
  enrollmentCount: number;
};

export type ChapterInstructorRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  grade: string | null;
  trainingComplete: number;
  trainingTotal: number;
  offerings: ChapterInstructorOffering[];
};

export type ChapterClassTemplateOption = {
  id: string;
  title: string;
  deliveryModes: string[];
  durationWeeks: number;
  maxStudents: number;
};

export type ChapterClassLocationOption = {
  id: string;
  name: string;
  location: string | null;
  partnerType: string | null;
};

function darkenHex(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function coverForOffering(offering: ChapterInstructorOffering) {
  const theme =
    offering.themeColor && /^#[0-9a-fA-F]{6}$/.test(offering.themeColor)
      ? offering.themeColor.toLowerCase()
      : null;
  if (theme) {
    return { from: theme, to: darkenHex(theme, 0.16) };
  }
  let hash = 0;
  for (let i = 0; i < offering.id.length; i += 1) {
    hash = (hash * 31 + offering.id.charCodeAt(i)) >>> 0;
  }
  return COVER_PALETTE[hash % COVER_PALETTE.length]!;
}

function splitClassTitle(title: string): { main: string; detail: string | null } {
  const parts = title.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { main: parts[0]!, detail: parts.slice(1).join(" — ") };
  }
  return { main: title.trim() || "Class", detail: null };
}

function scheduleLine(offering: ChapterInstructorOffering): string {
  const days = offering.meetingDays?.length
    ? offering.meetingDays.map((d) => d.slice(0, 3)).join("/")
    : null;
  const time = offering.meetingTime?.trim() || null;
  if (days && time) return `${days} · ${time}`;
  if (days) return days;
  if (time) return time;
  return offering.deliveryMode?.replaceAll("_", " ") || "Class";
}

function isActiveStatus(status: string) {
  return !["COMPLETED", "CANCELLED"].includes(status);
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function ClassCard({
  offering,
  muted = false,
}: {
  offering: ChapterInstructorOffering;
  muted?: boolean;
}) {
  const cover = coverForOffering(offering);
  const { main: titleMain, detail: titleDetail } = splitClassTitle(offering.title);
  const coverSub = [titleDetail, scheduleLine(offering)].filter(Boolean).join(" · ");
  const studentCount = offering.enrollmentCount;

  return (
    <Link
      href={`/instructor/classes/${offering.id}`}
      className={[
        "group flex flex-col overflow-hidden rounded-2xl border border-[#dadce0] bg-white no-underline shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition-[box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(60,64,67,0.14)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        muted ? "opacity-80" : "",
      ].join(" ")}
    >
      <div
        className="relative h-[112px] px-4 pb-3 pt-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${cover.from} 0%, ${cover.to} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 20%, #fff 0, transparent 42%), radial-gradient(circle at 10% 90%, #fff 0, transparent 36%)",
          }}
        />
        <h3 className="relative m-0 line-clamp-2 text-[18px] font-medium leading-snug tracking-[-0.01em]">
          {titleMain}
        </h3>
        <p className="relative m-0 mt-1.5 line-clamp-1 text-[12.5px] text-white/85">
          {coverSub}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#f1f3f4] pt-3">
          <span className="text-[12.5px] text-[#5f6368]">
            {studentCount === 0
              ? "No students yet"
              : `${studentCount} student${studentCount === 1 ? "" : "s"}`}
          </span>
          {muted ? (
            <span className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-[#80868b]">
              Done
            </span>
          ) : (
            <span className="text-[12.5px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
              Open →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function AddClassCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#dadce0] bg-white/70 px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-[22px] font-semibold leading-none text-brand-700">
        +
      </span>
      <span className="text-[14px] font-semibold text-[#202124]">Add class</span>
      <span className="text-[12.5px] text-[#5f6368]">Create and assign to this instructor</span>
    </button>
  );
}

function ProfileModal({
  instructor,
  open,
  onClose,
}: {
  instructor: ChapterInstructorRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!instructor) return null;

  const trainingPercent =
    instructor.trainingTotal > 0
      ? Math.round((instructor.trainingComplete / instructor.trainingTotal) * 100)
      : null;
  const activeClasses = instructor.offerings.filter((o) => isActiveStatus(o.status));

  return (
    <ModalV2 open={open} onClose={onClose} labelledBy={titleId} size="md">
      <div className="flex flex-col gap-4">
        <div>
          <h2 id={titleId} className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {instructor.name}
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">Instructor profile</p>
        </div>

        <dl className="m-0 grid gap-3 text-[13.5px]">
          <div>
            <dt className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Email
            </dt>
            <dd className="m-0 mt-0.5">
              <a
                href={`mailto:${instructor.email}`}
                className="text-brand-700 no-underline hover:underline"
              >
                {instructor.email}
              </a>
            </dd>
          </div>
          {instructor.phone ? (
            <div>
              <dt className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Phone
              </dt>
              <dd className="m-0 mt-0.5 text-ink">{instructor.phone}</dd>
            </div>
          ) : null}
          {instructor.school ? (
            <div>
              <dt className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                School
              </dt>
              <dd className="m-0 mt-0.5 text-ink">{instructor.school}</dd>
            </div>
          ) : null}
          {instructor.grade ? (
            <div>
              <dt className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Grade
              </dt>
              <dd className="m-0 mt-0.5 text-ink">{instructor.grade}</dd>
            </div>
          ) : null}
          <div>
            <dt className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Training
            </dt>
            <dd className="m-0 mt-1">
              {trainingPercent == null ? (
                <StatusBadge tone="neutral">No training rows</StatusBadge>
              ) : (
                <StatusBadge tone={trainingPercent === 100 ? "success" : "warning"}>
                  {instructor.trainingComplete}/{instructor.trainingTotal} complete (
                  {trainingPercent}%)
                </StatusBadge>
              )}
            </dd>
          </div>
          <div>
            <dt className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Classes
            </dt>
            <dd className="m-0 mt-1 text-ink">
              {activeClasses.length === 0
                ? "No active classes"
                : activeClasses.map((o) => o.title).join(" · ")}
            </dd>
          </div>
        </dl>

        <ModalFooterV2>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </ModalFooterV2>
      </div>
    </ModalV2>
  );
}

function AddClassModal({
  open,
  onClose,
  instructors,
  templates,
  locations,
  chapterId,
  initialInstructorId,
}: {
  open: boolean;
  onClose: () => void;
  instructors: ChapterInstructorRow[];
  templates: ChapterClassTemplateOption[];
  locations: ChapterClassLocationOption[];
  chapterId: string;
  initialInstructorId: string | null;
}) {
  const titleId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [instructorId, setInstructorId] = useState(initialInstructorId ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState(templates[0]?.title ?? "");
  const [partnerId, setPartnerId] = useState(locations[0]?.id ?? "");
  const [meetingDays, setMeetingDays] = useState<string[]>(["Tuesday"]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === partnerId) ?? null,
    [locations, partnerId]
  );

  useEffect(() => {
    if (!open) return;
    setInstructorId(initialInstructorId ?? instructors[0]?.id ?? "");
    setError("");
    const first = templates[0];
    if (first) {
      setTemplateId(first.id);
      setTitle(first.title);
    }
    setPartnerId(locations[0]?.id ?? "");
    setMeetingDays(["Tuesday"]);
  }, [open, initialInstructorId, instructors, templates, locations]);

  function toggleDay(day: string) {
    setMeetingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function onTemplateChange(nextId: string) {
    setTemplateId(nextId);
    const next = templates.find((t) => t.id === nextId);
    if (next) setTitle(next.title);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!instructorId) {
      setError("Choose an instructor for this class.");
      return;
    }
    if (!templateId) {
      setError("Choose a class template.");
      return;
    }
    if (!partnerId || !selectedLocation) {
      setError("Choose a chapter location for this in-person class.");
      return;
    }
    if (meetingDays.length === 0) {
      setError("Pick at least one meeting day.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("instructorId", instructorId);
    formData.set("templateId", templateId);
    formData.set("title", title.trim());
    formData.set("meetingDays", meetingDays.join(","));
    formData.set("deliveryMode", "IN_PERSON");
    formData.set("chapterId", chapterId);
    formData.set("partnerId", partnerId);
    formData.set("locationName", selectedLocation.name);
    formData.set(
      "locationAddress",
      selectedLocation.location?.trim() || selectedLocation.name
    );

    startTransition(async () => {
      try {
        const result = await createClassOffering(formData);
        onClose();
        router.refresh();
        router.push(`/instructor/classes/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create class");
      }
    });
  }

  return (
    <ModalV2
      open={open}
      onClose={pending ? () => undefined : onClose}
      labelledBy={titleId}
      size="lg"
      locked={pending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h2 id={titleId} className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            Add class
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            In-person class at one of your chapter locations.
          </p>
        </div>

        {error ? (
          <p
            className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Instructor</span>
            <select
              required
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            >
              <option value="" disabled>
                Select instructor
              </option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Template</span>
            <select
              required
              value={templateId}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            >
              {templates.length === 0 ? (
                <option value="" disabled>
                  No published templates
                </option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-ink">Class title</span>
          <input
            required
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            placeholder="e.g. Behavioral Science — Spring Cohort C"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-ink">Location</span>
          {locations.length === 0 ? (
            <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              No chapter locations yet. Add a partner site first, then create the class.
            </p>
          ) : (
            <>
              <select
                required
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.partnerType ? ` · ${loc.partnerType.replaceAll("_", " ")}` : ""}
                  </option>
                ))}
              </select>
              {selectedLocation?.location ? (
                <span className="text-[12.5px] text-ink-muted">{selectedLocation.location}</span>
              ) : null}
            </>
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Start date</span>
            <input
              required
              type="date"
              name="startDate"
              defaultValue={isoDateOffset(7)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">End date</span>
            <input
              required
              type="date"
              name="endDate"
              defaultValue={isoDateOffset(
                7 + Math.max(1, (selectedTemplate?.durationWeeks ?? 6) * 7)
              )}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 text-[13px] font-semibold text-ink">Meeting days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const on = meetingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={[
                    "rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
                    on
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-line bg-white text-ink-muted hover:border-brand-300",
                  ].join(" ")}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Meeting time</span>
            <input
              required
              name="meetingTime"
              defaultValue="16:00-17:00"
              placeholder="16:00-17:00"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Capacity</span>
            <input
              required
              type="number"
              name="capacity"
              min={1}
              defaultValue={selectedTemplate?.maxStudents ?? 18}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>
        </div>

        <input type="hidden" name="deliveryMode" value="IN_PERSON" />

        <ModalFooterV2>
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending || templates.length === 0 || locations.length === 0}
          >
            {pending ? "Creating…" : "Create class"}
          </Button>
        </ModalFooterV2>
      </form>
    </ModalV2>
  );
}

/** Header CTA + shared create modal. */
export function ChapterAddClassButton({
  instructors,
  templates,
  locations,
  chapterId,
  initialInstructorId = null,
  label = "Add class",
  variant = "primary",
}: {
  instructors: ChapterInstructorRow[];
  templates: ChapterClassTemplateOption[];
  locations: ChapterClassLocationOption[];
  chapterId: string | null;
  initialInstructorId?: string | null;
  label?: string;
  variant?: "primary" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [forInstructorId, setForInstructorId] = useState<string | null>(initialInstructorId);

  function openModal(instructorId?: string | null) {
    setForInstructorId(instructorId ?? initialInstructorId ?? null);
    setOpen(true);
  }

  return (
    <>
      {variant === "primary" ? (
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => openModal(initialInstructorId)}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-brand-700 hover:underline"
        >
          {label}
        </button>
      )}

      {chapterId ? (
        <AddClassModal
          open={open}
          onClose={() => setOpen(false)}
          instructors={instructors}
          templates={templates}
          locations={locations}
          chapterId={chapterId}
          initialInstructorId={forInstructorId}
        />
      ) : open ? (
        <ModalV2 open onClose={() => setOpen(false)} labelledBy="missing-chapter" size="sm">
          <div className="flex flex-col gap-3">
            <h2 id="missing-chapter" className="m-0 text-[18px] font-semibold text-ink">
              Chapter not found
            </h2>
            <p className="m-0 text-[13.5px] text-ink-muted">
              Your account is not linked to a chapter, so a class cannot be created yet.
            </p>
            <ModalFooterV2>
              <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)}>
                Close
              </Button>
            </ModalFooterV2>
          </div>
        </ModalV2>
      ) : null}
    </>
  );
}

export function ChapterInstructorsClassroom({
  instructors,
  templates,
  locations,
  chapterId,
}: {
  instructors: ChapterInstructorRow[];
  templates: ChapterClassTemplateOption[];
  locations: ChapterClassLocationOption[];
  chapterId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForInstructorId, setAddForInstructorId] = useState<string | null>(null);
  const selected = instructors.find((i) => i.id === selectedId) ?? null;

  function openAddClass(instructorId?: string) {
    setAddForInstructorId(instructorId ?? null);
    setAddOpen(true);
  }

  if (instructors.length === 0) {
    return (
      <EmptyStateV2
        title="No instructors yet"
        body="Add instructors from Recruiting first, then create classes for them here."
        action={
          <Link
            href="/chapter/recruiting"
            className="text-[13.5px] font-medium text-brand-700 no-underline hover:underline"
          >
            Open Recruiting →
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-10">
        {instructors.map((instructor) => {
          const active = instructor.offerings.filter((o) => isActiveStatus(o.status));
          const completed = instructor.offerings.filter((o) => o.status === "COMPLETED");

          return (
            <section key={instructor.id} aria-labelledby={`instructor-${instructor.id}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8eaed] pb-3">
                <div className="min-w-0">
                  <h2
                    id={`instructor-${instructor.id}`}
                    className="m-0 truncate text-[18px] font-medium tracking-[-0.01em] text-[#202124]"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(instructor.id)}
                      className="cursor-pointer border-0 bg-transparent p-0 text-left text-inherit hover:text-brand-700"
                    >
                      {instructor.name}
                    </button>
                  </h2>
                  <p className="m-0 mt-0.5 truncate text-[13px] text-[#5f6368]">
                    {instructor.email}
                    {active.length > 0
                      ? ` · ${active.length} class${active.length === 1 ? "" : "es"}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openAddClass(instructor.id)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-brand-700 hover:underline"
                  >
                    Add class
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(instructor.id)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-[#5f6368] hover:underline"
                  >
                    Profile
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((offering) => (
                  <ClassCard key={offering.id} offering={offering} />
                ))}
                <AddClassCard onClick={() => openAddClass(instructor.id)} />
              </div>

              {completed.length > 0 ? (
                <div className="mt-6">
                  <h3 className="m-0 mb-3 text-[12px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
                    Completed ({completed.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {completed.map((offering) => (
                      <ClassCard key={offering.id} offering={offering} muted />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <ProfileModal
        instructor={selected}
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
      />

      {chapterId ? (
        <AddClassModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          instructors={instructors}
          templates={templates}
          locations={locations}
          chapterId={chapterId}
          initialInstructorId={addForInstructorId}
        />
      ) : null}
    </>
  );
}
