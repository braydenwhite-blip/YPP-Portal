import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireChapterCalendarManager } from "@/lib/chapter-calendar-auth";
import {
  getChapterCalendarEntries,
  getGlobalCalendarEntries,
} from "@/lib/chapter-calendar";
import {
  cancelChapterEventAction,
  saveChapterEventAction,
} from "@/lib/chapter-calendar-actions";
import { ConfirmSubmitButton } from "@/components/chapter-dashboard/confirm-submit-button";
import { ChapterCalendarBoard } from "@/components/chapter/chapter-calendar-board";
import { ButtonLink } from "@/components/ui-v2";

type ChapterCalendarPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateTimeLocal(date: Date | null | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function occurrenceSummary(startDate: Date, endDate: Date) {
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} · ${startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} – ${endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default async function ChapterCalendarPage(props: ChapterCalendarPageProps) {
  const searchParams = await props.searchParams;
  const manager = await requireChapterCalendarManager(singleParam(searchParams?.chapterId) || null);
  const eventId = singleParam(searchParams?.eventId) || null;

  const chapter = await prisma.chapter.findUnique({
    where: { id: manager.chapterId },
    select: {
      id: true,
      name: true,
      slug: true,
      publicProfileEnabled: true,
    },
  });

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const rangeStart = addDays(new Date(), -7);
  const rangeEnd = addDays(new Date(), 120);

  const [selectedEvent, chapterEntries, globalEntries, manualEvents] = await Promise.all([
    eventId
      ? prisma.event.findUnique({
          where: { id: eventId },
          include: { chapter: true },
        })
      : null,
    getChapterCalendarEntries({
      chapterId: chapter.id,
      start: rangeStart,
      end: rangeEnd,
      includeInternal: true,
      subscribedChapterIds: [],
    }),
    getGlobalCalendarEntries({
      start: rangeStart,
      end: rangeEnd,
      includeInternal: true,
    }),
    prisma.event.findMany({
      where: {
        chapterId: chapter.id,
        isCancelled: false,
        startDate: { gte: addDays(new Date(), -1) },
      },
      orderBy: { startDate: "asc" },
      take: 20,
      include: { rsvps: { select: { id: true } } },
    }),
  ]);

  const editingOwnEvent =
    selectedEvent && selectedEvent.chapterId === chapter.id ? selectedEvent : null;

  const upcomingEntries = [...chapterEntries, ...globalEntries].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  const defaults = editingOwnEvent
    ? {
        title: editingOwnEvent.title,
        description: editingOwnEvent.description,
        eventType: editingOwnEvent.eventType,
        visibility: editingOwnEvent.visibility,
        location: editingOwnEvent.location || "",
        meetingUrl: editingOwnEvent.meetingUrl || "",
        startDate: toDateTimeLocal(editingOwnEvent.startDate),
        endDate: toDateTimeLocal(editingOwnEvent.endDate),
      }
    : {
        title: "",
        description: "",
        eventType: "WORKSHOP",
        visibility: "INTERNAL",
        location: "",
        meetingUrl: "",
        startDate: "",
        endDate: "",
      };

  const publicSlug = chapter.slug || chapter.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#80868b]">
              My Chapter
            </p>
            <h1 className="m-0 mt-1 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              {chapter.name} Calendar
            </h1>
            <p className="m-0 mt-1 max-w-2xl text-[14px] text-[#5f6368]">
              Browse chapter and YPP-wide events, then create or edit a chapter event below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/chapter/hub" variant="secondary" size="sm">
              ← My Chapter
            </ButtonLink>
            {chapter.publicProfileEnabled ? (
              <ButtonLink href={`/chapters/${publicSlug}`} variant="secondary" size="sm">
                Public profile
              </ButtonLink>
            ) : null}
          </div>
        </header>

        <ChapterCalendarBoard chapterName={chapter.name} entries={upcomingEntries} />

        <section
          id="manage-calendar"
          className="mt-8 overflow-hidden rounded-[20px] border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f4] px-5 py-4">
            <div>
              <h2 className="m-0 text-[16px] font-semibold text-[#202124]">
                {editingOwnEvent ? "Edit event" : "Create event"}
              </h2>
              <p className="m-0 mt-1 text-[13px] text-[#5f6368]">
                {editingOwnEvent
                  ? "Update this chapter event and save."
                  : "Add a workshop, showcase, or meeting for your chapter."}
              </p>
            </div>
            {editingOwnEvent ? (
              <Link
                href="/chapter/calendar"
                className="rounded-full border border-[#dadce0] px-3 py-1.5 text-[12.5px] font-medium text-[#3c4043] no-underline hover:bg-[#f8f9fa]"
              >
                Cancel edit
              </Link>
            ) : null}
          </div>

          <form action={saveChapterEventAction} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <input type="hidden" name="chapterId" value={chapter.id} />
            <input type="hidden" name="scope" value="CHAPTER" />
            <input type="hidden" name="recurrenceFrequency" value="NONE" />
            <input type="hidden" name="reminder24Hr" value="true" />
            <input type="hidden" name="reminder1Hr" value="true" />
            {editingOwnEvent ? <input type="hidden" name="eventId" value={editingOwnEvent.id} /> : null}

            <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
              <span className="font-semibold text-[#202124]">Title</span>
              <input
                required
                name="title"
                defaultValue={defaults.title}
                placeholder="e.g. Spring Showcase"
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#202124]">Type</span>
              <select
                name="eventType"
                defaultValue={defaults.eventType}
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              >
                <option value="WORKSHOP">Workshop</option>
                <option value="SHOWCASE">Showcase</option>
                <option value="FESTIVAL">Festival</option>
                <option value="COMPETITION">Competition</option>
                <option value="ALUMNI_EVENT">Alumni event</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#202124]">Visibility</span>
              <select
                name="visibility"
                defaultValue={defaults.visibility}
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              >
                <option value="INTERNAL">Chapter only</option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#202124]">Starts</span>
              <input
                required
                type="datetime-local"
                name="startDate"
                defaultValue={defaults.startDate}
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#202124]">Ends</span>
              <input
                required
                type="datetime-local"
                name="endDate"
                defaultValue={defaults.endDate}
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#202124]">Location</span>
              <input
                name="location"
                defaultValue={defaults.location}
                placeholder="Room, school, or address"
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#202124]">Meeting link</span>
              <input
                name="meetingUrl"
                defaultValue={defaults.meetingUrl}
                placeholder="https://"
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
              <span className="font-semibold text-[#202124]">Description</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={defaults.description}
                placeholder="What members should know…"
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center justify-center rounded-full border-0 bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-700"
              >
                {editingOwnEvent ? "Save changes" : "Create event"}
              </button>
            </div>
          </form>

          <div className="border-t border-[#f1f3f4] px-5 py-5">
            <h3 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#80868b]">
              Upcoming chapter events
            </h3>
            {manualEvents.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-[#dadce0] bg-[#f8f9fa] px-4 py-6 text-center text-[13.5px] text-[#5f6368]">
                No upcoming chapter events yet.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {manualEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dadce0] bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[14px] font-semibold text-[#202124]">{event.title}</p>
                      <p className="m-0 mt-0.5 text-[12.5px] text-[#5f6368]">
                        {occurrenceSummary(event.startDate, event.endDate)}
                        {" · "}
                        {event.visibility === "PUBLIC" ? "Public" : "Chapter only"}
                        {" · "}
                        {event.rsvps.length} RSVP{event.rsvps.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/chapter/calendar?eventId=${event.id}#manage-calendar`}
                        className="rounded-full border border-[#dadce0] px-3 py-1.5 text-[12.5px] font-medium text-[#3c4043] no-underline hover:bg-[#f8f9fa]"
                      >
                        Edit
                      </Link>
                      <form action={cancelChapterEventAction}>
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <input
                          type="hidden"
                          name="cancellationReason"
                          value="Cancelled from the chapter calendar."
                        />
                        <ConfirmSubmitButton
                          className="cursor-pointer rounded-full border border-[#dadce0] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#c5221f] hover:bg-[#fce8e6]"
                          confirm={`Cancel "${event.title}"?`}
                          pendingText="Cancelling…"
                        >
                          Cancel
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
