import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireChapterCalendarManager } from "@/lib/chapter-calendar-auth";
import { getChapterCalendarEntries } from "@/lib/chapter-calendar";
import {
  archiveChapterMilestoneAction,
  cancelChapterEventAction,
  saveChapterEventAction,
  saveChapterMilestoneAction,
  updateChapterProfileAction,
} from "@/lib/chapter-calendar-actions";

type ChapterCalendarPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const RECURRENCE_DAY_OPTIONS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

function toDateTimeLocal(date: Date | null | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateInput(date: Date | null | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function occurrenceSummary(startDate: Date, endDate: Date) {
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} · ${startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default async function ChapterCalendarPage({ searchParams }: ChapterCalendarPageProps) {
  const manager = await requireChapterCalendarManager(singleParam(searchParams?.chapterId) || null);
  const eventId = singleParam(searchParams?.eventId) || null;
  const seriesId = singleParam(searchParams?.seriesId) || null;
  const milestoneId = singleParam(searchParams?.milestoneId) || null;

  const chapter = await prisma.chapter.findUnique({
    where: { id: manager.chapterId },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      region: true,
      publicProfileEnabled: true,
      publicSummary: true,
      publicStory: true,
      publicContactEmail: true,
      publicContactUrl: true,
      calendarDescription: true,
      calendarThemeColor: true,
    },
  });

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const [selectedEvent, selectedSeries, selectedMilestone, upcomingEntries, seriesList, manualEvents, milestoneList] =
    await Promise.all([
      eventId
        ? prisma.event.findUnique({
            where: { id: eventId },
            include: { chapter: true, series: true },
          })
        : null,
      seriesId
        ? prisma.eventSeries.findUnique({
            where: { id: seriesId },
            include: { chapter: true },
          })
        : null,
      milestoneId
        ? prisma.chapterMilestone.findUnique({
            where: { id: milestoneId },
            include: { chapter: true },
          })
        : null,
      getChapterCalendarEntries({
        chapterId: chapter.id,
        start: addDays(new Date(), -7),
        end: addDays(new Date(), 120),
        includeInternal: true,
        subscribedChapterIds: [],
      }),
      prisma.eventSeries.findMany({
        where: { chapterId: chapter.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.event.findMany({
        where: { chapterId: chapter.id },
        orderBy: { startDate: "asc" },
        take: 24,
        include: {
          rsvps: { select: { id: true } },
        },
      }),
      prisma.chapterMilestone.findMany({
        where: { chapterId: chapter.id, isArchived: false },
        orderBy: { dueDate: "asc" },
        take: 24,
      }),
    ]);

  const editingSeries = selectedSeries && (!selectedEvent || seriesId);
  const eventFormDefaults = editingSeries
    ? {
        title: selectedSeries.title,
        description: selectedSeries.description,
        eventType: selectedSeries.eventType,
        visibility: selectedSeries.visibility,
        location: selectedSeries.location || "",
        meetingUrl: selectedSeries.meetingUrl || "",
        startDate: toDateTimeLocal(selectedSeries.startDate),
        endDate: toDateTimeLocal(selectedSeries.endDate),
        reminder24Hr: selectedSeries.reminder24Hr,
        reminder1Hr: selectedSeries.reminder1Hr,
        recurrenceFrequency: selectedSeries.recurrenceFrequency,
        recurrenceInterval: selectedSeries.recurrenceInterval,
        recurrenceUntil: toDateInput(selectedSeries.recurrenceUntil),
        recurrenceCount: selectedSeries.recurrenceCount ? String(selectedSeries.recurrenceCount) : "",
        recurrenceDays: selectedSeries.recurrenceDays,
      }
    : selectedEvent
      ? {
          title: selectedEvent.title,
          description: selectedEvent.description,
          eventType: selectedEvent.eventType,
          visibility: selectedEvent.visibility,
          location: selectedEvent.location || "",
          meetingUrl: selectedEvent.meetingUrl || "",
          startDate: toDateTimeLocal(selectedEvent.startDate),
          endDate: toDateTimeLocal(selectedEvent.endDate),
          reminder24Hr: selectedEvent.reminder24Hr,
          reminder1Hr: selectedEvent.reminder1Hr,
          recurrenceFrequency: "NONE",
          recurrenceInterval: 1,
          recurrenceUntil: "",
          recurrenceCount: "",
          recurrenceDays: [] as string[],
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
          reminder24Hr: true,
          reminder1Hr: true,
          recurrenceFrequency: "NONE",
          recurrenceInterval: 1,
          recurrenceUntil: "",
          recurrenceCount: "",
          recurrenceDays: [] as string[],
        };

  const autoFeedEntries = upcomingEntries.filter(
    (entry) => entry.source === "CLASS_SESSION" || entry.source === "LAUNCH_TASK"
  );

  const publicSlug = chapter.slug || chapter.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <main className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">Chapter President Workspace</p>
          <h1 className="page-title">{chapter.name} Calendar</h1>
          <p className="page-subtitle">
            Create chapter events, manage recurring series, and shape what the public chapter profile shows.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/chapter" className="button outline small">
            Chapter Dashboard
          </Link>
          <Link href="/my-chapter/calendar" className="button outline small">
            Member Calendar View
          </Link>
          {chapter.publicProfileEnabled ? (
            <Link href={`/chapters/${publicSlug}`} className="button small">
              Open Public Profile
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Step 1: Build the chapter calendar</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
            Use the form below to create one chapter event, create a recurring series, or edit one
            occurrence when a single date needs to change. This is the place where Chapter Presidents
            own the chapter schedule day by day.
          </p>
        </section>
        <section className="card">
          <div className="grid two" style={{ gap: 12 }}>
            <div>
              <div className="kpi">{manualEvents.length}</div>
              <div className="kpi-label">Manual events</div>
            </div>
            <div>
              <div className="kpi">{seriesList.length}</div>
              <div className="kpi-label">Recurring series</div>
            </div>
            <div>
              <div className="kpi">{milestoneList.length}</div>
              <div className="kpi-label">Milestones</div>
            </div>
            <div>
              <div className="kpi">{autoFeedEntries.length}</div>
              <div className="kpi-label">Auto-fed items</div>
            </div>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>
              {editingSeries
                ? "Edit recurring series"
                : selectedEvent
                  ? "Edit one occurrence"
                  : "Create chapter event"}
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              Pick “None” to make one event, or choose a recurrence rule to build a series.
            </p>
          </div>
          {(selectedEvent || selectedSeries) ? (
            <Link href="/chapter/calendar" className="button outline small">
              Clear edit mode
            </Link>
          ) : null}
        </div>

        <form action={saveChapterEventAction} className="form-grid">
          <input type="hidden" name="chapterId" value={chapter.id} />
          {selectedEvent ? <input type="hidden" name="eventId" value={selectedEvent.id} /> : null}
          {editingSeries ? <input type="hidden" name="seriesId" value={selectedSeries?.id} /> : null}

          <label className="form-row">
            Title
            <input className="input" name="title" defaultValue={eventFormDefaults.title} required />
          </label>

          <label className="form-row">
            Description
            <textarea className="input" name="description" rows={3} defaultValue={eventFormDefaults.description} />
          </label>

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Event type
              <select className="input" name="eventType" defaultValue={eventFormDefaults.eventType}>
                <option value="SHOWCASE">Showcase</option>
                <option value="FESTIVAL">Festival</option>
                <option value="COMPETITION">Competition</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="ALUMNI_EVENT">Alumni Event</option>
              </select>
            </label>

            <label className="form-row">
              Visibility
              <select className="input" name="visibility" defaultValue={eventFormDefaults.visibility}>
                <option value="INTERNAL">Internal chapter view</option>
                <option value="PUBLIC">Public chapter profile</option>
              </select>
            </label>
          </div>

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Start date and time
              <input className="input" type="datetime-local" name="startDate" defaultValue={eventFormDefaults.startDate} required />
            </label>

            <label className="form-row">
              End date and time
              <input className="input" type="datetime-local" name="endDate" defaultValue={eventFormDefaults.endDate} required />
            </label>
          </div>

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Location
              <input className="input" name="location" defaultValue={eventFormDefaults.location} />
            </label>

            <label className="form-row">
              Meeting URL
              <input className="input" name="meetingUrl" defaultValue={eventFormDefaults.meetingUrl} />
            </label>
          </div>

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Recurrence
              <select className="input" name="recurrenceFrequency" defaultValue={eventFormDefaults.recurrenceFrequency}>
                <option value="NONE">None</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>

            <label className="form-row">
              Repeat every
              <input className="input" type="number" min={1} name="recurrenceInterval" defaultValue={String(eventFormDefaults.recurrenceInterval)} />
            </label>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Weekly repeat days</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {RECURRENCE_DAY_OPTIONS.map((day) => (
                <label key={day} className="pill" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="recurrenceDays"
                    value={day}
                    defaultChecked={eventFormDefaults.recurrenceDays.includes(day)}
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Repeat until
              <input className="input" type="date" name="recurrenceUntil" defaultValue={eventFormDefaults.recurrenceUntil} />
            </label>

            <label className="form-row">
              Max occurrences
              <input className="input" type="number" min={1} name="recurrenceCount" defaultValue={eventFormDefaults.recurrenceCount} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label className="checkbox-label">
              <input type="checkbox" name="reminder24Hr" defaultChecked={eventFormDefaults.reminder24Hr} />
              24-hour reminders
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="reminder1Hr" defaultChecked={eventFormDefaults.reminder1Hr} />
              1-hour reminders
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="isAlumniOnly" defaultChecked={false} />
              Alumni-only
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" type="submit">
              {selectedEvent || selectedSeries ? "Save changes" : "Create calendar item"}
            </button>
            {(selectedEvent || selectedSeries) ? (
              <Link href="/chapter/calendar" className="button outline">
                Start a fresh event
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Upcoming manual events</h3>
          </div>
          {manualEvents.length === 0 ? (
            <p className="empty">No manual chapter events yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {manualEvents.map((event) => (
                <article key={event.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>{event.title}</strong>
                      <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                        {occurrenceSummary(event.startDate, event.endDate)}
                      </p>
                      <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                        {event.visibility} · {event.rsvps.length} RSVP{event.rsvps.length === 1 ? "" : "s"}
                        {event.isCancelled ? " · Cancelled" : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/chapter/calendar?eventId=${event.id}`} className="button outline small">
                        Edit occurrence
                      </Link>
                      {event.seriesId ? (
                        <Link href={`/chapter/calendar?seriesId=${event.seriesId}`} className="button outline small">
                          Edit series
                        </Link>
                      ) : null}
                      {!event.isCancelled ? (
                        <form action={cancelChapterEventAction}>
                          <input type="hidden" name="chapterId" value={chapter.id} />
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="cancellationReason" value="Cancelled from the chapter calendar workspace." />
                          <button type="submit" className="button outline small">
                            Cancel event
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Recurring series</h3>
          </div>
          {seriesList.length === 0 ? (
            <p className="empty">No recurring series yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {seriesList.map((series) => (
                <article key={series.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <strong>{series.title}</strong>
                  <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                    {series.recurrenceFrequency} every {series.recurrenceInterval}
                    {series.recurrenceFrequency === "WEEKLY" ? " week(s)" : series.recurrenceFrequency === "MONTHLY" ? " month(s)" : " day(s)"}
                  </p>
                  {series.recurrenceDays.length > 0 ? (
                    <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                      Days: {series.recurrenceDays.join(", ")}
                    </p>
                  ) : null}
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/chapter/calendar?seriesId=${series.id}`} className="button outline small">
                      Edit series
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                {selectedMilestone ? "Edit chapter milestone" : "Create chapter milestone"}
              </h3>
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                Milestones show chapter deadlines in the shared calendar without pretending they are full events.
              </p>
            </div>
            {selectedMilestone ? (
              <Link href="/chapter/calendar" className="button outline small">
                Clear milestone edit
              </Link>
            ) : null}
          </div>

          <form action={saveChapterMilestoneAction} className="form-grid">
            <input type="hidden" name="chapterId" value={chapter.id} />
            {selectedMilestone ? <input type="hidden" name="milestoneId" value={selectedMilestone.id} /> : null}

            <label className="form-row">
              Title
              <input className="input" name="title" defaultValue={selectedMilestone?.title || ""} required />
            </label>

            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} defaultValue={selectedMilestone?.description || ""} />
            </label>

            <div className="grid two" style={{ gap: 12 }}>
              <label className="form-row">
                Due date
                <input className="input" type="datetime-local" name="dueDate" defaultValue={toDateTimeLocal(selectedMilestone?.dueDate)} required />
              </label>
              <label className="form-row">
                Visibility
                <select className="input" name="visibility" defaultValue={selectedMilestone?.visibility || "INTERNAL"}>
                  <option value="INTERNAL">Internal chapter view</option>
                  <option value="PUBLIC">Public chapter profile</option>
                </select>
              </label>
            </div>

            <button className="button" type="submit">
              {selectedMilestone ? "Save milestone" : "Create milestone"}
            </button>
          </form>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {milestoneList.map((milestone) => (
              <article key={milestone.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                <strong>{milestone.title}</strong>
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                  {milestone.dueDate.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })} · {milestone.visibility}
                </p>
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/chapter/calendar?milestoneId=${milestone.id}`} className="button outline small">
                    Edit milestone
                  </Link>
                  <form action={archiveChapterMilestoneAction}>
                    <input type="hidden" name="chapterId" value={chapter.id} />
                    <input type="hidden" name="milestoneId" value={milestone.id} />
                    <button type="submit" className="button outline small">
                      Archive
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h3 style={{ marginTop: 0 }}>Auto-fed chapter items</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            These are read-only because they come from other chapter systems. They still appear in
            the shared chapter calendar so students and staff can see the whole picture in one place.
          </p>
          {autoFeedEntries.length === 0 ? (
            <p className="empty">No auto-fed class sessions or rollout deadlines are scheduled yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {autoFeedEntries.map((entry) => (
                <article key={entry.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <strong>{entry.title}</strong>
                  <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                    {entry.eventTypeLabel} · {new Date(entry.startDate).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: entry.allDay ? undefined : "numeric",
                      minute: entry.allDay ? undefined : "2-digit",
                    })}
                  </p>
                  {entry.link ? (
                    <div style={{ marginTop: 10 }}>
                      <Link href={entry.link} className="button outline small">
                        Open source
                      </Link>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h3 style={{ marginTop: 0, marginBottom: 6 }}>Step 2: Shape the public chapter profile</h3>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          This controls what the public chapter page shares about your chapter, your story, and your public calendar.
        </p>

        <form action={updateChapterProfileAction} className="form-grid">
          <input type="hidden" name="chapterId" value={chapter.id} />

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Public slug
              <input className="input" name="slug" defaultValue={publicSlug} />
            </label>

            <label className="form-row">
              Theme color
              <input className="input" name="calendarThemeColor" defaultValue={chapter.calendarThemeColor || ""} placeholder="#2563eb" />
            </label>
          </div>

          <label className="checkbox-label">
            <input type="checkbox" name="publicProfileEnabled" defaultChecked={chapter.publicProfileEnabled} />
            Turn on the public chapter profile
          </label>

          <label className="form-row">
            Public summary
            <textarea className="input" name="publicSummary" rows={3} defaultValue={chapter.publicSummary || ""} />
          </label>

          <label className="form-row">
            Public story
            <textarea className="input" name="publicStory" rows={5} defaultValue={chapter.publicStory || ""} />
          </label>

          <label className="form-row">
            Calendar description
            <textarea className="input" name="calendarDescription" rows={3} defaultValue={chapter.calendarDescription || ""} />
          </label>

          <div className="grid two" style={{ gap: 12 }}>
            <label className="form-row">
              Contact email
              <input className="input" type="email" name="publicContactEmail" defaultValue={chapter.publicContactEmail || ""} />
            </label>

            <label className="form-row">
              Contact URL
              <input className="input" name="publicContactUrl" defaultValue={chapter.publicContactUrl || ""} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" type="submit">Save public profile</button>
            {chapter.publicProfileEnabled ? (
              <Link href={`/chapters/${publicSlug}`} className="button outline">
                View public page
              </Link>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}
